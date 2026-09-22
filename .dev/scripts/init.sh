#!/usr/bin/env bash
set -e

echo "Настройка окружения (unix)..."
echo "------------------------------------------------------------"

# 1. Установка FNM (Fast Node Manager) и Node.js 26
if ! command -v fnm &> /dev/null; then
    echo "📦 Устанавливаем fnm (менеджер версий Node.js)..."
    curl -fsSL https://fnm.vercel.app/install | bash
    
    # Временно добавляем в PATH для текущей сессии
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "`fnm env`"
else
    echo "✅ fnm уже установлен"
fi

echo "🟢 Устанавливаем и активируем Node.js v26..."
fnm install 26
fnm default 26
fnm use 26

echo "------------------------------------------------------------"

# 2. Установка Bun
if ! command -v bun &> /dev/null; then
    echo "📦 Устанавливаем Bun..."
    curl -fsSL https://bun.sh/install | bash
else
    echo "✅ Bun уже установлен ($(bun --version)). Запускаем обновление..."
    bun upgrade
fi

echo "------------------------------------------------------------"
echo "🎉 Окружение успешно установлено!"
echo "⚠️ ВАЖНО: Перезапустите терминал (или выполните 'source ~/.bashrc' / 'source ~/.zshrc'),"
echo "затем выполните команду: bun install"