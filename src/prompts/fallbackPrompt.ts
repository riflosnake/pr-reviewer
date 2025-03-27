export const getFallbackPrompt = (allSummaries: string[]): string => {
    return `
  ### **Pull Request Summary Request**
  
  You have received feedback for each of the files in the pull request. Here are the individual feedbacks:
  
  ${allSummaries.join('\n\n---\n\n')}
  
  ### **Task:**
  Please generate a brief but comprehensive summary of the overall pull request based on the individual feedbacks provided above. Focus on:
  
  - **Key Points:** What are the significant changes or patterns noticed across the files?
  - **Quality Issues:** Highlight any common issues or areas of improvement that could apply to the entire PR.
  - **Suggestions:** Provide any general suggestions for improvement, architecture, or optimization if applicable.
  - **Conciseness:** Keep your comment professional and succinct.
  
  ### **Additional Context:**
  This PR includes updates to multiple files. Please consider the quality, performance, security, and any potential bugs in the overall review. Avoid repeating details already given in individual file reviews. Focus on summarizing the overall impact and potential improvements.
  
  ---
  
  **Response Structure:**  
  Your response should match the following format:
  
  **summary:** (a short summary of the overall feedback based on all the individual file reviews. This is a concise overview of the PR)
  
  **detailedFeedback:** (detailed feedback about the PR, including quality issues, patterns, or anything notable from the individual file reviews)
  
  ---
  
  **Note:** Please keep your response well-structured and concise. If no feedback is needed, you can simply return an empty response, but ideally provide any relevant summary and suggestions based on the overall review of the pull request.
  `;
  };
  