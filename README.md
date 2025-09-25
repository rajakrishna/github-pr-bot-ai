# AI Code Reviews - GitHub PR Bot

An intelligent GitHub bot that provides AI-powered code reviews and automatically implements suggested changes across your codebase. Built with TypeScript, Express, Octokit SDK, and Gemini.

## Features

- Automatically analyzes code changes in new pull requests
- Provides intelligent, context-aware comments that:
  - Identifies bugs and logical errors
  - Highlights performance issues and inefficiencies
- Uses AI to holistically implement suggested changes across multiple files
- Built as a GitHub App for easy installation in multiple repositories
- Deployable to Google Cloud Run

## Prerequisites

- Node.js 22 or higher
- A GitHub account
- Google Cloud account (for deployment)
- Gemini API key

## Setup

### 1. Create a GitHub App

1. Go to your GitHub account settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in the required information:
   - GitHub App name: `GitHub PR Bot AI` (or any name you prefer)
   - Homepage URL: Can be a placeholder URL for now
   - Webhook URL: Will be updated after deployment
   - Webhook secret: Generate a random string and save it
   - Permissions:
     - **Repository permissions:**
       - Pull requests: Read & Write (to read PR details and post reviews)
       - Issues: Read & Write (to post comments and create issues)
       - Metadata: Read (to access repository information)
       - Contents: Read & Write (to read files and create branches/PRs)
     - **Account permissions:**
       - Email addresses: Read (to identify users)
   - Subscribe to events:
     - Pull request (opened, synchronize, closed)
     - Issue comment (created)
     - Pull request review comment (created)
4. Create the app
5. Generate a private key and download it
6. Note your GitHub App ID, Client ID, and Client Secret
7. Note the username of your GitHub App (visible in the app settings)

### 2. Local Development and Testing

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and fill in your GitHub App details, including the `GITHUB_BOT_USERNAME`
4. Start the development server:
   ```bash
   npm run dev
   ```

#### Local Webhook Testing

For testing webhooks during local development, you have several options:

- **Using smee.io**: Proxy webhook events to your local development server:

  ```bash
  npm install -g smee-client
  smee --url https://smee.io/YOUR_UNIQUE_URL --target http://localhost:3000/webhook
  ```

  Then update your GitHub App's webhook URL to use the smee.io URL.

- **ngrok**: Expose your local server to the internet:

  ```bash
  ngrok http 3000
  ```

  Use the generated ngrok URL as your webhook URL in GitHub App settings.

- **Online Testing Tools**:
  - **[HookBox](https://www.hookbox.app/)**: Real-time webhook debugging
  - **[Webhook.site](https://webhook.site/)**: Capture and inspect HTTP requests
  - **[Webhook Tester](https://www.kloudbean.com/webhook-tester/)**: Test endpoints with custom requests

### 3. Deploy to Google Cloud Run

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
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
   # Build the container image
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/github-pr-bot
   gcloud run deploy github-pr-bot --image gcr.io/YOUR_PROJECT_ID/github-pr-bot --platform managed
   ```
5. Set environment variables in Google Cloud Run:
   - Go to the Cloud Run service in Google Cloud Console
   - Click "Edit & Deploy New Revision"
   - Under "Variables & Secrets", add all environment variables from your `.env` file
   - Deploy the new revision

#### Other Cloud Providers

- **Vercel**: Deploy using `vercel` CLI
- **Railway**: Connect your GitHub repo and deploy
- **Heroku**: Use `heroku create` and `git push heroku main`
- **AWS Lambda**: Use the Serverless Framework or AWS SAM

### 4. Configure Webhook

1. Get the URL of your deployed Cloud Run service
2. Update your GitHub App settings with this URL as the Webhook URL (append `/webhook` to the URL)
3. Make sure the webhook secret matches what you set in your environment variables

### 5. Production Testing

After deployment, test your webhook integration:

#### GitHub's Built-in Testing

- **Verify Deliveries**: Check webhook deliveries in your GitHub App settings under "Advanced" → "Recent Deliveries"
- **Redeliver Webhooks**: Use GitHub's interface to redeliver previous webhook events for testing
- **View Payload**: Inspect the actual payload data sent by GitHub

For comprehensive webhook testing guidance, refer to the [GitHub Webhooks Testing Documentation](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/testing-webhooks).

## Installing the Bot

1. Go to your GitHub App's page
2. Click "Install App" in the sidebar
3. Choose the repositories where you want to install the bot
4. The bot will now provide AI-powered code reviews on all new pull requests in those repositories

## Using the Bot

### AI Code Reviews

The bot automatically analyzes new pull requests and provides detailed code reviews as comments, focusing on errors and performance issues.

### Creating PRs from Suggestions

When the AI review suggests code changes, you can have the bot automatically implement them:

1. After receiving an AI review comment
2. Comment on the PR with `/apply-suggestions` or `/create-pr-from-suggestions`
3. The bot will:
   - Send the entire review and all relevant files to Gemini
   - AI analyzes the review holistically and generates updated file contents
   - Create a new branch based on your PR branch
   - Apply all suggested changes across multiple files
   - Create a new PR targeting your original PR branch
   - Comment with a link to the new PR

## Troubleshooting

### Common Issues

#### Webhook Not Receiving Events

- **Check URL**: Ensure webhook URL ends with `/webhook`
- **Verify Secret**: Webhook secret must match environment variable
- **Test Delivery**: Use GitHub's webhook delivery testing
- **Check Logs**: Review application logs for errors

#### AI Analysis Failing

- **API Key**: Verify `GOOGLE_GENERATIVE_AI_API_KEY` is correct and has quota
- **Rate Limits**: Check if you're hitting Gemini API limits
- **File Size**: Large files may timeout - consider implementing chunking

#### Permission Errors

- **App Permissions**: Ensure GitHub App has required permissions
- **Installation**: Verify app is installed on target repositories
- **Token Scope**: Check if the generated token has proper scopes

#### Deployment Issues

- **Environment Variables**: Ensure all required variables are set
- **Memory Limits**: Increase memory allocation if experiencing OOM errors
- **Cold Starts**: Consider using minimum instances for better response times

## License

MIT
