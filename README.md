# GitHub PR Bot

A GitHub bot that provides AI-powered code reviews on every new pull request. This bot is built with TypeScript, Express, the Octokit SDK for GitHub API integration, and the Vercel AI SDK with Google AI.

## Features

- Automatically analyzes code changes in new pull requests
- Provides intelligent, context-aware comments that:
  - Summarize the changes
  - Highlight good practices
  - Suggest improvements
  - Ask relevant questions
- Built as a GitHub App for easy installation in multiple repositories
- Deployable to Google Cloud Run

## Prerequisites

- Node.js 18 or higher
- A GitHub account
- Google Cloud Platform account (for deployment)
- Google AI API key

## Setup

### 1. Create a GitHub App

1. Go to your GitHub account settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in the required information:
   - GitHub App name: `PR Greeting Bot` (or any name you prefer)
   - Homepage URL: Can be a placeholder URL for now
   - Webhook URL: Will be updated after deployment
   - Webhook secret: Generate a random string and save it
   - Permissions:
     - Pull requests: Read & Write
     - Metadata: Read-only
     - Repository contents: Read-only (needed for installation)
   - Subscribe to events:
     - Pull request
4. Create the app
5. Generate a private key and download it
6. Note your GitHub App ID, Client ID, and Client Secret

### 2. Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and fill in your GitHub App details
4. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Deploy to Google Cloud Run

1. Install the Google Cloud SDK
2. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   ```
3. Set your project:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
4. Build and deploy the container:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/github-pr-bot
   gcloud run deploy github-pr-bot --image gcr.io/YOUR_PROJECT_ID/github-pr-bot --platform managed
   ```
5. Set environment variables in Google Cloud Run:
   - Go to the Cloud Run service
   - Click "Edit & Deploy New Revision"
   - Add all the environment variables from your `.env` file, including your `GOOGLE_AI_API_KEY`
   - Deploy the new revision

### 4. Configure Webhook

1. Get the URL of your deployed Cloud Run service
2. Update your GitHub App settings with this URL as the Webhook URL (append `/webhook` to the URL)
3. Make sure the webhook secret matches what you set in your environment variables

## Installing the Bot

1. Go to your GitHub App's page
2. Click "Install App" in the sidebar
3. Choose the repositories where you want to install the bot
4. The bot will now provide AI-powered code reviews on all new pull requests in those repositories

## Development

- `npm run build` - Build the TypeScript code
- `npm run start` - Start the production server
- `npm run dev` - Start the development server with hot reloading

## License

MIT
