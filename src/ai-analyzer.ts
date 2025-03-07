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
You are a helpful code reviewer bot. Analyze the following pull request and provide a constructive, friendly comment.

Repository: ${owner}/${repo}
PR #${prNumber}: ${prTitle}
Description: ${prDescription || 'No description provided'}

Changed files:
${fileChanges}

Provide a helpful comment that:
1. Summarizes the changes
2. Highlights good practices you notice
3. Suggests improvements if applicable
4. Asks relevant questions if needed
5. Keeps a friendly, constructive tone

Your comment should be formatted in Markdown.
`;

    // Generate the comment using Google AI
    const { text } = await generateText({
      model: googleAI,
      prompt: prompt,
      temperature: 0.7,
    });

    const result = text;
    return result || 'Hello! I reviewed your PR but encountered an issue generating detailed feedback.';
  } catch (error) {
    console.error('Error generating AI comment:', error);
    return 'Hello! 👋 I tried to analyze your PR but encountered an issue. A human reviewer will take a look soon.';
  }
}
