import express from 'express';
import * as dotenv from 'dotenv';
import { initializeGitHubApp, getInstallationOctokit } from './github-app.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => {
    (req as any).rawBody = buf;
  }
}));

const githubApp = initializeGitHubApp();

githubApp.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
  try {
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const prNumber = payload.pull_request.number;

    console.log(`New PR #${prNumber} opened in ${owner}/${repo}`);

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
  console.log('webhook headers',JSON.stringify({headers:req.headers}));
  try {
    // Use the App's webhook handler
    console.log('webhook input data',JSON.stringify({
      id,
      name,
      payload: req.body,
      signature
    }));
    await githubApp.webhooks.verifyAndReceive({
      id,
      name,
      payload: JSON.stringify(req.body),
      signature
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