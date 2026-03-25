# Test if server starts correctly

Write-Host "Testing server startup..." -ForegroundColor Cyan

Set-Location packages\server

# Load environment variables
$envPath = "..\..\...env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^=#]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
    Write-Host "Environment variables loaded" -ForegroundColor Green
}

# Start server in background for testing
Write-Host "Starting server..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    node src/index.js
}

# Wait for server to start
Start-Sleep -Seconds 3

# Check if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "Server is running successfully!" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json
    }
} catch {
    Write-Host "Server health check failed: $_" -ForegroundColor Red
}

# Stop the server
Stop-Job $serverJob
Remove-Job $serverJob

Set-Location ..\..

Write-Host "`nServer test completed" -ForegroundColor Cyan

