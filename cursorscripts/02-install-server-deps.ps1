# Install server dependencies

Write-Host "Installing server dependencies..." -ForegroundColor Cyan

Set-Location packages\server
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "Server dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Error installing server dependencies" -ForegroundColor Red
    exit 1
}

Set-Location ..\..

