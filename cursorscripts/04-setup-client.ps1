# Set up React client with Vite

Write-Host "Setting up React client..." -ForegroundColor Cyan

Set-Location packages\client

# Initialize Vite with React + TypeScript (overwrite existing package.json)
Write-Host "Initializing Vite..." -ForegroundColor Yellow
npm create vite@latest . -- --template react-ts

# Install additional dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
npm install socket.io-client zustand framer-motion

# Install and initialize Tailwind CSS
Write-Host "Setting up Tailwind CSS..." -ForegroundColor Yellow
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

Write-Host "Client setup completed!" -ForegroundColor Green

Set-Location ..\..

