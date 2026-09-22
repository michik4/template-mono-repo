Write-Host "Настройка окружения (win)..." -ForegroundColor Cyan
Write-Host "------------------------------------------------------------"

# 1. Установка FNM и Node.js 26
if (-not (Get-Command fnm -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Устанавливаем fnm (менеджер версий Node.js)..." -ForegroundColor Yellow
    irm https://fnm.vercel.app/install.ps1 | iex
    
    # Временно добавляем в PATH для текущей сессии
    $env:PATH += ";$HOME\AppData\Roaming\fnm"
} else {
    Write-Host "✅ fnm уже установлен" -ForegroundColor Green
}

Write-Host "🟢 Устанавливаем и активируем Node.js v26..." -ForegroundColor Yellow
fnm install 26
fnm default 26
fnm use 26

Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

# 2. Установка Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Устанавливаем Bun..." -ForegroundColor Yellow
    irm bun.sh/install.ps1 | iex
} else {
    Write-Host "✅ Bun уже установлен. Запускаем обновление..." -ForegroundColor Green
    bun upgrade
}

Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "🎉 Окружение успешно установлено!" -ForegroundColor Green
Write-Host "⚠️ ВАЖНО: Перезапустите VS Code или терминал PowerShell," -ForegroundColor Red
Write-Host "чтобы команды обновились, а затем выполните команду: bun install" -ForegroundColor White