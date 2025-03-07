import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';

const googleAI = google('gemini-2.0-flash-lite-preview-02-05');

export async function generatePRComment(
  owner: string,
  repo: string,
  prNumber: number,
  prTitle: string,
  prDescription: string,
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>
): Promise<string> {
  try {
    // Prepare the prompt with PR information
    const fileChanges = files
      .map(file => {
        return `
File: ${file.filename}
Status: ${file.status}
Changes: +${file.additions} -${file.deletions}
${file.patch ? `\nDiff:\n${file.patch}` : ''}
      `;
      })
      .join('\n---\n');

    const prompt = `
You are an expert code reviewer bot. Analyze the following pull request and provide a thorough, constructive review.

Repository: ${owner}/${repo}
PR #${prNumber}: ${prTitle}
Description: ${prDescription || 'No description provided'}

Changed files:
${fileChanges}

Provide a comprehensive code review that:
1. Summarizes the changes
2. Identifies any potential bugs, errors, or code smells
3. Highlights security vulnerabilities if present
4. Points out performance issues or inefficiencies
5. Suggests specific improvements with code examples where appropriate
6. Recommends best practices and design patterns
7. Checks for proper error handling and edge cases
8. Evaluates test coverage and suggests additional tests if needed
9. Maintains a friendly, constructive tone throughout

For each issue found, please:
- Clearly identify the file and line number
- Explain why it's problematic
- Provide a specific solution or improvement

Your review should be formatted in Markdown with appropriate sections and code blocks.
`;

    // Generate the comment using Google AI
    const { text } = await generateText({
      model: googleAI,
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 4000, // Ensure we have enough tokens for a thorough review
    });

    const result = text;
    return result || 'Hello! I reviewed your PR but encountered an issue generating detailed feedback.';
  } catch (error) {
    console.error('Error generating AI comment:', error);
    return 'Hello! 👋 I tried to analyze your PR but encountered an issue. A human reviewer will take a look soon.';
  }
}
