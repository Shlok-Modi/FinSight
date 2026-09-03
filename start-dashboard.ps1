# Start Express Server on Port 4000 in a new window
Write-Host "Starting Express Backend on http://localhost:4000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location module1-server; npm run dev"

# Start React Dev Client on Port 5173 in a new window
Write-Host "Starting Vite React Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location module1-client; npm run dev"
