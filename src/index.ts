import express from 'express';
import * as dotenv from 'dotenv';
import { initializeGitHubApp } from './github-app.ts';
import { generatePRComment, createPRFromSuggestions } from './ai-analyzer.ts';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  express.json({
    verify: (req, res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

const githubApp = initializeGitHubApp();

githubApp.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
  try {
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const prNumber = payload.pull_request.number;
    const prTitle = payload.pull_request.title;
    const prDescription = payload.pull_request.body || '';

    console.log(`New PR #${prNumber} opened in ${owner}/${repo}`);

    const prAuthor = payload.pull_request.user.login;

    const botUsername = process.env.GITHUB_BOT_USERNAME || '';
    if (prAuthor === botUsername) {
      console.log(`PR #${prNumber} is from our bot, skipping`);
      return;
    }

    // Get the PR files to analyze the changes
    const { data: files } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner,
      repo,
      pull_number: prNumber,
    });

    // Generate AI-powered comment
    const commentBody = await generatePRComment(owner, repo, prNumber, prTitle, prDescription, files);

    // Create a comment on the pull request
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });

    console.log(`AI comment posted on PR #${prNumber}`);
  } catch (error) {
    console.error('Error commenting on PR:', error);

    // Fallback to simple comment if AI analysis fails
    try {
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      const prNumber = payload.pull_request.number;

      await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
        body: 'Hello! 👋 I encountered an issue analyzing your PR. A human reviewer will take a look soon.',
      });
    } catch (fallbackError) {
      console.error('Error posting fallback comment:', fallbackError);
    }
  }
});

// Add a new webhook handler for issue comments (PR comments)
githubApp.webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
  try {
    // Only process comments on PRs
    if (!payload.issue.pull_request) {
      return;
    }

    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const prNumber = payload.issue.number;
    const commentBody = payload.comment.body || '';

    // Skip if no user or login
    if (!payload.comment.user || !payload.comment.user.login) {
      console.log(`Comment on PR #${prNumber} has no author, skipping`);
      return;
    }

    const commentAuthor = payload.comment.user.login;

    // Check if the comment is from our bot
    const botUsername = process.env.GITHUB_BOT_USERNAME || '';
    if (commentAuthor === botUsername) {
      console.log(`Comment on PR #${prNumber} is from our bot, skipping`);
      return;
    }

    // Check if the comment contains a command to create a PR from suggestions
    if (commentBody.includes('/apply-suggestions') || commentBody.includes('/create-pr-from-suggestions')) {
      console.log(`Received command to create PR from suggestions on PR #${prNumber}`);

      // Get the bot's last comment on this PR
      const { data: comments } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
      });

      console.log('comments', JSON.stringify(comments));

      // Find the last comment from our bot
      const botComments = comments.filter(comment => {
        return comment.user && comment.user.login === botUsername;
      });

      if (botComments.length === 0) {
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner,
          repo,
          issue_number: prNumber,
          body: 'No AI review comments found for this PR. Please wait for the AI review to complete first.',
        });
        return;
      }

      // Post a comment that we're working on it
      await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
        body: '🤖 Processing your request to apply AI suggestions. This may take a moment...',
      });

      const lastBotComment = botComments[botComments.length - 1];
      const reviewCommentText = lastBotComment.body || '';

      try {
        // Create a PR with the suggested changes
        const pullRequest = await createPRFromSuggestions(octokit, owner, repo, prNumber, reviewCommentText);

        // Comment on the PR with a link to the new PR
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner,
          repo,
          issue_number: prNumber,
          body: `✅ Created a new PR with AI-generated changes: #${pullRequest.number} (${pullRequest.html_url})`,
        });

        console.log(`Created PR #${pullRequest.number} with AI-generated changes for PR #${prNumber}`);
      } catch (error: any) {
        console.error('Error creating PR from suggestions:', error);

        // Create a more helpful error message based on the error
        let errorMessage = 'An unexpected error occurred.';

        if (error.message) {
          if (error.message.includes('No files found')) {
            errorMessage = '❌ No files were found in this PR. Make sure the PR contains file changes.';
          } else if (error.message.includes('Could not retrieve content')) {
            errorMessage =
              '❌ Could not retrieve file contents. This may be due to permission issues or large binary files.';
          } else if (error.message.includes('No valid suggestions')) {
            errorMessage =
              '❌ The AI could not generate any valid suggestions from the review. Try being more specific in your review comments.';
          } else {
            errorMessage = `❌ Error creating PR from suggestions: ${error.message}`;
          }
        }

        // Post error message
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner,
          repo,
          issue_number: prNumber,
          body: errorMessage,
        });
      }
    }
  } catch (error) {
    console.error('Error processing PR comment:', error);

    try {
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      const prNumber = payload.issue.number;

      await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
        body: 'Error processing comment. Please check the logs for details.',
      });
    } catch (fallbackError) {
      console.error('Error posting fallback comment:', fallbackError);
    }
  }
});

// Webhook endpoint for GitHub events
app.post('/webhook', async (req, res) => {
  const id = req.headers['x-github-delivery'] as string;
  const name = req.headers['x-github-event'] as string;
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!id || !name) {
    return res.status(400).send('Missing required GitHub webhook headers');
  }
  console.log('webhook headers', JSON.stringify({ headers: req.headers }));
  try {
    // Use the App's webhook handler
    console.log(
      'webhook input data',
      JSON.stringify({
        id,
        name,
        payload: req.body,
        signature,
      })
    );
    await githubApp.webhooks.verifyAndReceive({
      id,
      name,
      payload: JSON.stringify(req.body),
      signature,
    });

    res.status(200).send('Event received');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('GitHub PR Bot is ready to receive events');
});
