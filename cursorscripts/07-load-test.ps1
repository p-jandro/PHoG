$root = Get-Location
$serverDir = Join-Path $root "packages\server"

Write-Host "Starting Server..."
$job = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm start
} -ArgumentList $serverDir

Write-Host "Waiting for server (10s)..."
Start-Sleep -Seconds 10

Write-Host "Running Load Test..."
try {
    node packages/server/test/loadTest.js
} finally {
    Write-Host "Stopping Server..."
    Stop-Job $job
    Remove-Job $job
}

