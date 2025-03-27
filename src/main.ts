import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getPrompt } from './prompt.js';
import { bedrockClient } from './bedrockClient.js';
import { octokit } from './octokit.js';

dotenv.config();

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

const app = express();
const port = process.env.PORT || 3000;

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

  console.log(`Files changed in PR #${pr.number}:`);
  for (const file of filesResponse.data) {
    console.log(`- ${file.filename}`);

    if (file.patch) {
      const aiFeedback = await analyzeCodeWithAI(file.filename, file.patch);
      
      if (aiFeedback) {
        await postPRComment(pr, aiFeedback);
      }
    }
  }
}

// Function to analyze code using AWS Bedrock
async function analyzeCodeWithAI(filename: string, codeDiff: string): Promise<string | null> {
  try {
    const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-v2'; // Set your Bedrock model

    const fi = filename;

    const prompt = getPrompt(filename, codeDiff)

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt,
        max_tokens: 1024, // Ensures detailed response
        temperature: 0.7, // Balances creativity and accuracy
        top_p: 0.9, // Controls randomness
      }),
    });

    const response = await bedrockClient.send(command);

    if (response.body) {
      const responseText = response.body.transformToString();
      return responseText;
    }
  } catch (error) {
    console.error('Error calling AWS Bedrock:', error);
  }

  return null;
}

// Function to post AI-generated feedback as a comment in the PR
async function postPRComment(pr: GitHubPullRequest, comment: string): Promise<void> {
  await octokit.rest.issues.createComment({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    issue_number: pr.number,
    body: `🤖 AI Code Review Feedback:\n\n${comment}`,
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
