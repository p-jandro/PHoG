# Install host dependencies

Write-Host "Installing host dependencies..." -ForegroundColor Cyan

Set-Location packages\host
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "Host dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Error installing host dependencies" -ForegroundColor Red
    exit 1
}

Set-Location ..\..

