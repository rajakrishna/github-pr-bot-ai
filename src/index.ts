import express from 'express';
import dotenv from 'dotenv';
// import { Octokit } from 'octokit';
import { initializeGitHubApp, getInstallationOctokit } from './github-app';
import { verifyWebhookSignature } from './webhook-verification';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request body
app.use(express.json({
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    (req as any).rawBody = buf;
  }
}));

// Initialize GitHub App
const githubApp = initializeGitHubApp();

// Webhook endpoint for GitHub events
app.post('/webhook', verifyWebhookSignature, async (req, res) => {
  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  console.log(`Received ${event} event`);

  try {
    // Handle pull request events
    if (event === 'pull_request' && payload.action === 'opened') {
      await handlePullRequestOpened(payload);
    }

    res.status(200).send('Event received');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Function to handle new pull requests
async function handlePullRequestOpened(payload: any): Promise<void> {
  const repo = payload.repository.name;
  const owner = payload.repository.owner.login;
  const prNumber = payload.pull_request.number;

  console.log(`New PR #${prNumber} opened in ${owner}/${repo}`);

  try {
    // Get an authenticated Octokit instance for this repository
    const octokit = await getInstallationOctokit(githubApp, owner, repo);

    // Create a comment on the pull request
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner,
      repo,
      issue_number: prNumber,
      body: 'Hello! 👋',
    });

    console.log(`Commented on PR #${prNumber}`);
  } catch (error) {
    console.error('Error commenting on PR:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('GitHub PR Bot is ready to receive events');
}); 