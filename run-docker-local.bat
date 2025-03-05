@echo off
echo Stopping any existing github-pr-bot containers...
docker stop github-pr-bot 2>nul
docker rm github-pr-bot 2>nul

echo Building Docker image with verbose output...
docker build --progress=plain -t github-pr-bot .

if not exist .env (
  echo .env file not found, creating from .env.example...
  copy .env.example .env
  echo Please edit .env file with your actual credentials before continuing.
  exit /b 1
)

echo Running Docker container...
docker run -d --name github-pr-bot -p 3000:8080 --env-file .env github-pr-bot

echo Container started. Status:
docker ps | findstr github-pr-bot

echo.
echo Your application is now running at http://localhost:3000
echo To view logs: docker logs github-pr-bot
echo To stop: docker stop github-pr-bot 