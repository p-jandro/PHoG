# Install client dependencies

Write-Host "Installing client dependencies..." -ForegroundColor Cyan

Set-Location packages\client
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "Client dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Error installing client dependencies" -ForegroundColor Red
    exit 1
}

Set-Location ..\..

