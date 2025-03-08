import { Octokit, App } from 'octokit';
import * as fs from 'fs';
import * as path from 'path';

export const initializeGitHubApp = () => {
  try {
    let privateKey: string;

    if (process.env.GITHUB_PRIVATE_KEY) {
      // If the private key is provided as an environment variable
      privateKey = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else if (process.env.GITHUB_PRIVATE_KEY_PATH) {
      // If the private key is provided as a file path
      privateKey = fs.readFileSync(path.resolve(process.env.GITHUB_PRIVATE_KEY_PATH), 'utf8');
    } else {
      throw new Error('GitHub App private key not found');
    }
    console.log('initializeGitHubApp');

    const octokit = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: privateKey,
      webhooks: {
        secret: process.env.GITHUB_WEBHOOK_SECRET || 'secret',
      },
      Octokit: Octokit.defaults({
        auth: {
          appId: process.env.GITHUB_APP_ID!,
          privateKey: privateKey,
        },
      }),
    });

    console.log('GitHub App initialized successfully');
    return octokit;
  } catch (error) {
    console.error('Error initializing GitHub App:', error);
    throw error;
  }
};

export const getInstallationOctokit = async (appOctokit: App, owner: string, repo: string) => {
  try {
    const installation = await appOctokit.octokit.request('GET /repos/{owner}/{repo}/installation', {
      owner,
      repo,
    });

    const installationOctokit = await appOctokit.getInstallationOctokit(installation.data.id);

    return installationOctokit;
  } catch (error) {
    console.error(`Error getting installation for ${owner}/${repo}:`, error);
    throw error;
  }
};

export const createPullRequestFromSuggestions = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  baseBranch: string,
  headBranch: string,
  title: string,
  body: string,
  changes: Array<{
    file: string;
    content: string;
  }>
) => {
  try {
    // Get the latest commit SHA from the base branch to create our new branch from
    const { data: baseRef } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/heads/{branch}', {
      owner,
      repo,
      branch: baseBranch,
    });

    const baseSha = baseRef.object.sha;

    // Check if branch already exists, if not create it
    try {
      await octokit.request('GET /repos/{owner}/{repo}/git/ref/heads/{branch}', {
        owner,
        repo,
        branch: headBranch,
      });
      console.log(`Branch ${headBranch} already exists`);
    } catch (error) {
      // Branch doesn't exist, create it
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner,
        repo,
        ref: `refs/heads/${headBranch}`,
        sha: baseSha,
      });
      console.log(`Created branch ${headBranch} from ${baseBranch}`);
    }

    // Apply each file change
    for (const change of changes) {
      try {
        // Check if file exists to get its SHA (needed for update)
        const { data: existingFile } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: change.file,
          ref: headBranch,
        });

        // Update existing file - handle both single file and directory array responses
        const fileSha = Array.isArray(existingFile)
          ? existingFile.find(f => f.path === change.file)?.sha
          : existingFile.sha;

        if (!fileSha) {
          throw new Error(`Could not find SHA for ${change.file}`);
        }

        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: change.file,
          message: `Update ${change.file} with suggested changes`,
          content: Buffer.from(change.content).toString('base64'),
          sha: fileSha,
          branch: headBranch,
        });

        console.log(`Updated file ${change.file}`);
      } catch (error) {
        // File doesn't exist, create it
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: change.file,
          message: `Create ${change.file} with suggested changes`,
          content: Buffer.from(change.content).toString('base64'),
          branch: headBranch,
        });

        console.log(`Created file ${change.file}`);
      }
    }

    // Create a pull request
    const { data: pullRequest } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: baseBranch,
    });

    console.log(`Created PR #${pullRequest.number}: ${title}`);
    return pullRequest;
  } catch (error) {
    console.error('Error creating PR from suggestions:', error);
    throw error;
  }
};
