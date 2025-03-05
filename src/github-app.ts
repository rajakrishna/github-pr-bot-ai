import { Octokit } from 'octokit';
import fs from 'fs';
import path from 'path';

// Initialize GitHub App
export const initializeGitHubApp = () => {
  try {
    // Get private key from environment or file
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

    // Create GitHub App instance with Octokit
    const octokit = new Octokit({
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: privateKey,
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      }
    });

    console.log('GitHub App initialized successfully');
    return octokit;
  } catch (error) {
    console.error('Error initializing GitHub App:', error);
    throw error;
  }
};

// Get an installation access token for a repository
export const getInstallationOctokit = async (
  appOctokit: Octokit,
  owner: string,
  repo: string
) => {
  try {
    // Get the installation ID for the repository
    const { data: installation } = await appOctokit.request('GET /repos/{owner}/{repo}/installation', {
      owner,
      repo,
    });

    // Create a new Octokit instance with the installation token
    const installationOctokit = new Octokit({
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId: installation.id
      }
    });

    return installationOctokit;
  } catch (error) {
    console.error(`Error getting installation for ${owner}/${repo}:`, error);
    throw error;
  }
}; 