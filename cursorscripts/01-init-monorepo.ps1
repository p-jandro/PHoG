# Initialize monorepo structure for PHoG

Write-Host "Creating directory structure..." -ForegroundColor Cyan

# Create packages directories
New-Item -ItemType Directory -Force -Path "packages\server\src\games" | Out-Null
New-Item -ItemType Directory -Force -Path "packages\server\src\utils" | Out-Null
New-Item -ItemType Directory -Force -Path "packages\server\src\data" | Out-Null
New-Item -ItemType Directory -Force -Path "packages\client\src" | Out-Null
New-Item -ItemType Directory -Force -Path "packages\host\src" | Out-Null
New-Item -ItemType Directory -Force -Path "deploy" | Out-Null

Write-Host "Directory structure created" -ForegroundColor Green

# Create root package.json
$rootPackageJson = @'
{
  "name": "peter-house-of-games",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "server": "cd packages/server && npm run dev",
    "client": "cd packages/client && npm run dev",
    "host": "cd packages/host && npm run dev"
  }
}
'@

Set-Content -Path "package.json" -Value $rootPackageJson
Write-Host "Root package.json created" -ForegroundColor Green

# Create server package.json
$serverPackageJson = @'
{
  "name": "phog-server",
  "version": "1.0.0",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.2",
    "cors": "^2.8.5",
    "uuid": "^9.0.1",
    "joi": "^17.11.0",
    "an-array-of-english-words": "^2.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
'@

Set-Content -Path "packages\server\package.json" -Value $serverPackageJson
Write-Host "Server package.json created" -ForegroundColor Green

# Create client package.json placeholder
$clientPackageJson = @'
{
  "name": "phog-client",
  "version": "1.0.0",
  "private": true
}
'@

Set-Content -Path "packages\client\package.json" -Value $clientPackageJson
Write-Host "Client package.json created" -ForegroundColor Green

# Create host package.json placeholder
$hostPackageJson = @'
{
  "name": "phog-host",
  "version": "1.0.0",
  "private": true
}
'@

Set-Content -Path "packages\host\package.json" -Value $hostPackageJson
Write-Host "Host package.json created" -ForegroundColor Green

# Create .gitignore
$gitignore = @'
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.vite/
build/
'@

Set-Content -Path ".gitignore" -Value $gitignore
Write-Host ".gitignore created" -ForegroundColor Green

# Create .env.example
$envExample = @'
# Server Configuration
PORT=3000
NODE_ENV=development

# Client URLs (for CORS)
CLIENT_URL=http://localhost:5173
HOST_URL=http://localhost:5174

# Optional: Host authentication
HOST_PASSWORD=change-this-in-production
'@

Set-Content -Path ".env.example" -Value $envExample
Write-Host ".env.example created" -ForegroundColor Green

Write-Host ""
Write-Host "Monorepo structure initialized successfully!" -ForegroundColor Green
Write-Host "Next step: Install dependencies with npm install in each package" -ForegroundColor Yellow
