export const getFallbackPrompt = (allSummaries: string[]) => `
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

**Please format your response as follows:**

**General Overview:**

- A brief and clear summary of the pull request based on the file-level feedback.
- Any notable patterns, bugs, or improvement areas.
- Suggestions for general enhancements or architecture improvements.

**Note:** Keep the summary concise and to the point, avoiding unnecessary repetition.
`;
