import express, { Request, Response } from 'express';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getPrompt } from './prompts/prompt.js';
import { bedrockClient } from './bedrockClient.js';
import { octokit } from './octokit.js';
import { config } from './config.js';
import { getFallbackPrompt } from './prompts/fallbackPrompt.js';

interface GitHubPRPayload {
  action: string;
  pull_request: GitHubPullRequest;
}

interface GitHubPullRequest {
  number: number;
  user: {
    login: string;
  };
  base: {
    repo: {
      owner: {
        login: string;
      };
      name: string;
    };
  };
}

interface GitHubFile {
  filename: string;
  patch?: string; // Contains the diff of changes in the file
}

interface AIFeedback {
    commentNeeded: boolean;
    lineComments?: Array<{
      lineNumber: number;
      comment: string;
    }>;
    summary?: string;
    detailedFeedback?: string;
    codeSnippets?: {
      before: string;
      after: string;
    }[];
    message?: string;
  }
  

const app = express();
const port = config.PORT;

app.use(express.json());

// Webhook endpoint to receive pull request events
app.post('/webhook', async (req: Request, res: Response) => {
  const payload: GitHubPRPayload = req.body;

  if (payload.action === 'opened' || payload.action === 'synchronize') {
    const pr = payload.pull_request;

    console.log(`Pull Request #${pr.number} created/updated by ${pr.user.login}`);

    await processPR(pr);

    res.status(200).send('Webhook received!');
  } else {
    res.status(200).send('Event ignored');
  }
});

// Function to process the pull request
async function processPR(pr: GitHubPullRequest): Promise<void> {
  // Fetch the list of changed files in the PR
  const filesResponse = await octokit.rest.pulls.listFiles({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    pull_number: pr.number,
  });

  let hasCommented = false;
  let allSummaries: string[] = [];

  console.log(`Files changed in PR #${pr.number}:`);
  for (const file of filesResponse.data) {
    console.log(`- ${file.filename}`);

    if (file.patch) {
        const aiFeedback = await analyzeCodeWithAI(file.filename, file.patch);

        allSummaries.push(aiFeedback.summary)

        if (aiFeedback) {
            // Check if feedback is needed and if so, post it
            if (aiFeedback.commentNeeded) {
                // Check for line-specific comments
                if (aiFeedback.lineComments) {
                    // Post line comments to GitHub with file path, code snippet, and AI-generated comment
                    aiFeedback.lineComments.forEach(async (element) => {
                        // Create a snippet of the code to highlight around the changed line (3 lines of context)
                        const startLine = Math.max(element.lineNumber - 1, 0); // Ensure we don't go negative
                        const endLine = element.lineNumber + 2; // 3-line context (before, changed, after)
                        
                        const codeSnippet = `\`\`\`diff\n` + 
                            `@@ -${startLine + 1},${endLine - startLine + 1} @@\n` + 
                            `${element.comment}\n` +
                            `\`\`\``;
        
                        const comment = `**File Path:** ${pr.base.repo.name}/${file.filename}\n\n` + 
                            `**Code Changes:**\n${codeSnippet}\n\n` + 
                            `**AI Comment:**\n${element.comment}`;
        
                        // Post comment to GitHub
                        await postPRComment(pr, comment);
                        hasCommented = true;
                    });
                } else {
                    // If no line-specific comments, post general feedback
                    const comment = `${aiFeedback.summary || ''}\n\n${aiFeedback.detailedFeedback || ''}`;
                    await postPRComment(pr, comment);
                }
            } else {
                console.log(aiFeedback.message || 'No feedback required');
            }
        }
        
    }
  }

  if (!hasCommented && allSummaries){
    const overallSummaryPrompt = getFallbackPrompt(allSummaries);

    // Send the overall summary prompt to the AI model
    const prOverviewFeedback = await analyzeCodeWithAI('PR Overview', overallSummaryPrompt);

    if (prOverviewFeedback) {
        // Format the AI's response into a structured comment
        const overviewComment = `
                **General Overview:**

                ${prOverviewFeedback.summary || 'No significant changes detected.'}

                ---

                **Detailed Feedback:**

                ${prOverviewFeedback.detailedFeedback || 'No further details provided.'}

                `;

        await postPRComment(pr, overviewComment);
    } else {
        // In case no summary is generated, post a default message
        const defaultComment = `
                **General Overview:**

                No significant changes detected in the pull request.

                ---

                **Detailed Feedback:**

                There were no major issues or feedback found in the PR.
                `;

        await postPRComment(pr, defaultComment);
    }
}
}

async function analyzeCodeWithAI(filename: string, codeDiff: string): Promise<AIFeedback | null> {
    try {
      const modelId = config.BEDROCK_MODEL_ID;
  
      const prompt = `Human: ${getPrompt(filename, codeDiff)} Assistant:`;
  
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          prompt,
          max_tokens_to_sample: 1024, // Ensures detailed response
          temperature: 0.7, // Balances creativity and accuracy
          top_p: 0.9, // Controls randomness
        }),
      });
  
      const response = await bedrockClient.send(command);
  
      if (response.body) {
        const responseText = await response.body.transformToString();
        
        try {
          const parsedResponse: AIFeedback = JSON.parse(responseText);
  
          if (parsedResponse.commentNeeded === false) {
            return null; // No comment needed
          }
  
          // Return the parsed response with line-specific comments
          return parsedResponse;
        } catch (error) {
          console.error('Error parsing AI response:', error);
          return {
            commentNeeded: true,
            message: 'Error parsing AI response, fallback to raw response.',
          };
        }
      }
    } catch (error) {
      console.error('Error calling AWS Bedrock:', error);
    }
  
    return null; // Return null if something goes wrong
  }
  

// Function to post AI-generated feedback as a comment in the PR
async function postPRComment(pr: GitHubPullRequest, comment: string): Promise<void> {
    // Clean up the comment to extract only the meaningful text
    const cleanedComment = comment && comment.trim().replace(/\\n/g, '\n'); // Handle newlines properly
    
    const formattedComment = `🤖 AI Code Review Feedback:\n\n${cleanedComment}`;
  
    // Post the comment on the PR
    await octokit.rest.issues.createComment({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      issue_number: pr.number,
      body: formattedComment,
    });
  }

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
