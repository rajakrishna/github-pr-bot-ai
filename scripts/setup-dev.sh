#!/bin/bash

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  echo "Please update the .env file with your GitHub App credentials."
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

echo "Setup complete! You can now run 'npm run dev' to start the development server."
echo "Don't forget to update your .env file with your GitHub App credentials." 