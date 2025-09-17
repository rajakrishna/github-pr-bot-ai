import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';

const googleAI = google('gemini-2.5-flash');

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
      You are an expert code reviewer bot. Analyze the following pull request focusing only on errors and performance issues.

      Repository: ${owner}/${repo}
      PR #${prNumber}: ${prTitle}
      Description: ${prDescription || 'No description provided'}

      Changed files:
      ${fileChanges}

      Provide a focused code review that only:
      1. Identifies bugs 
      2. Highlights performance issues

      For each issue:
      - Specify file and line number
      - Explain the problem in one sentence
      - Provide a solution in a code block

      Include \`/apply-suggestions\` at the end  if there are any issues found and need to be applied. 
      If there are no issues found, do not include it. Format the comment as markdown.
      `;

    const { text } = await generateText({
      model: googleAI,
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    const result = text;
    console.log('LLM response', JSON.stringify(result));
    return result || 'Hello! I reviewed your PR but encountered an issue generating detailed feedback.';
  } catch (error) {
    console.error('Error generating AI comment:', error);
    return 'Hello! 👋 I tried to analyze your PR but encountered an issue. A human reviewer will take a look soon.';
  }
}

export async function processAISuggestions(
  commentBody: string,
  originalFiles: Map<string, string>
): Promise<
  Array<{
    file: string;
    content: string;
    description: string;
  }>
> {
  try {
    console.log(`Processing AI suggestions with ${originalFiles.size} files available`);

    if (originalFiles.size === 0) {
      console.error('No original files provided to processAISuggestions');
      return [];
    }

    // If no specific files are mentioned in the comment, use all files
    const fileRegex = /`{1,3}(?:.*?\/)?([^`\n]+?)(?::\d+(?::\d+)?)?`{1,3}/g;
    const fileMatches = new Set<string>();
    let match;

    while ((match = fileRegex.exec(commentBody)) !== null) {
      if (match[1] && !match[1].includes(' ') && originalFiles.has(match[1])) {
        fileMatches.add(match[1]);
      }
    }

    let filesToProcess: string[];

    if (fileMatches.size === 0) {
      console.log('No specific files found in comment, using all available files');
      filesToProcess = Array.from(originalFiles.keys());
    } else {
      filesToProcess = Array.from(fileMatches);
      console.log(`Found ${filesToProcess.length} files referenced in comment`);
    }

    if (filesToProcess.length === 0) {
      console.error('No files to process');
      return [];
    }

    // Create a single prompt with all files for Google AI
    let filesContent = '';
    for (const file of filesToProcess) {
      const originalContent = originalFiles.get(file) || '';
      filesContent += `\nFile: ${file}\n\`\`\`\n${originalContent}\n\`\`\`\n`;
    }

    // Create a prompt for Google AI to apply the suggestions to all files at once
    const prompt = `
      You are an expert code assistant. I have files that need changes based on a code review.

      Original files:
      ${filesContent}

      Code review comments:
      \`\`\`
      ${commentBody}
      \`\`\`

      Please apply the suggested changes to the files. For each file that needs changes, return:

      FILE: [filename]
      \`\`\`
      [complete updated file content with all changes applied]
      \`\`\`

      Only include files that need changes. Do not include any explanations between files, just the FILE: marker and code blocks.
      `;

    console.log('Sending prompt to Google AI');

    // Generate the updated file content using Google AI
    const { text } = await generateText({
      model: googleAI,
      prompt: prompt,
      temperature: 0.2, // Lower temperature for more deterministic results
      maxTokens: 8000,
    });

    if (!text) {
      console.log('No response from Google AI');
      return [];
    }

    console.log('Received response from Google AI, parsing results');

    // Parse the response to extract updated files
    const filePattern = /FILE:\s*([^\n]+)\n```(?:\w*\n)?([^`]+)```/g;
    const suggestions: Array<{
      file: string;
      content: string;
      description: string;
    }> = [];

    let fileMatch;
    while ((fileMatch = filePattern.exec(text)) !== null) {
      const fileName = fileMatch[1].trim();
      const fileContent = fileMatch[2].trim();

      // Only include if content actually changed and file exists in original files
      const originalContent = originalFiles.get(fileName);
      if (originalContent && fileContent !== originalContent.trim()) {
        console.log(`Found changes for file: ${fileName}`);
        suggestions.push({
          file: fileName,
          content: fileContent,
          description: `Applied AI-suggested changes to ${fileName}`,
        });
      } else if (!originalContent) {
        console.log(`File not found in original files: ${fileName}`);
      } else {
        console.log(`No changes detected for file: ${fileName}`);
      }
    }

    console.log(`Generated ${suggestions.length} file changes`);
    return suggestions;
  } catch (error) {
    console.error('Error processing AI suggestions:', error);
    return [];
  }
}

export async function createPRFromSuggestions(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  commentBody: string
) {
  try {
    // Get the original PR details
    const { data: originalPR } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: prNumber,
    });
    console.log('originalPR', JSON.stringify(originalPR));
    // Get all files in the PR
    const { data: files } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner,
      repo,
      pull_number: prNumber,
    });
    console.log('files', JSON.stringify(files));

    console.log(`Found ${files.length} files in PR #${prNumber}`);

    if (files.length === 0) {
      throw new Error('No files found in the PR');
    }

    // Create a map of file contents
    const originalFiles = new Map<string, string>();
    let filesProcessed = 0;

    for (const file of files) {
      try {
        // Skip deleted files
        if (file.status === 'removed') {
          console.log(`Skipping deleted file: ${file.filename}`);
          continue;
        }

        // Get the current file content
        const { data: fileData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: file.filename,
          ref: originalPR.head.ref,
        });

        // If file exists, decode its content
        if (fileData.content) {
          const content = Buffer.from(fileData.content, 'base64').toString();
          originalFiles.set(file.filename, content);
          filesProcessed++;
        } else {
          console.log(`No content found for file: ${file.filename}`);
        }
      } catch (error) {
        console.error(`Error getting content for ${file.filename}:`, error);
      }
    }

    console.log(`Successfully processed ${filesProcessed} files out of ${files.length}`);

    if (originalFiles.size === 0) {
      throw new Error('Could not retrieve content for any files in the PR');
    }

    // Process suggestions using AI
    const suggestions = await processAISuggestions(commentBody, originalFiles);

    if (suggestions.length === 0) {
      throw new Error('No valid suggestions generated by AI');
    }

    // Create a new branch name
    const timestamp = new Date().getTime();
    const newBranchName = `ai-suggested-changes-${prNumber}-${timestamp}`;

    // Create PR title and body
    const prTitle = `AI-Suggested Changes for PR #${prNumber}`;
    const prBody = `This PR contains AI-generated changes based on the review of PR #${prNumber}.

      ## Changes included:
      ${suggestions.map(s => `- **${s.file}**: ${s.description}`).join('\n')}

      Original PR: #${prNumber}
      
      `;

    // Create the PR with suggested changes
    const { createPullRequestFromSuggestions } = await import('./github-app.js');
    const pullRequest = await createPullRequestFromSuggestions(
      octokit,
      owner,
      repo,
      originalPR.head.ref, // Base branch is the PR's head branch
      newBranchName, // New branch for suggestions
      prTitle,
      prBody,
      suggestions.map(c => ({ file: c.file, content: c.content }))
    );

    return pullRequest;
  } catch (error) {
    console.error('Error creating PR from suggestions:', error);
    throw error;
  }
}
