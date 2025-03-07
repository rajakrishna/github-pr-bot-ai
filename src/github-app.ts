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
      privateKey = fs.readFileSync(
        path.resolve(process.env.GITHUB_PRIVATE_KEY_PATH),
        'utf8'
      );
    } else {
      throw new Error('GitHub App private key not found');
    }
    console.log('initializeGitHubApp');

    const octokit = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: privateKey,
      webhooks: {
        secret: process.env.GITHUB_WEBHOOK_SECRET || 'secret'
      },
      Octokit: Octokit.defaults({
        auth: {
          appId: process.env.GITHUB_APP_ID!,
          privateKey: privateKey
        }
      })
    });

    console.log('GitHub App initialized successfully');
    return octokit;
  } catch (error) {
    console.error('Error initializing GitHub App:', error);
    throw error;
  }
};

export const getInstallationOctokit = async (
  appOctokit: App,
  owner: string,
  repo: string
) => {
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