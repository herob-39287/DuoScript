@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo [DuoScript] 起動を開始します...

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js が見つかりません。先にインストールしてください。
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm が見つかりません。Node.js のインストール状態を確認してください。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules が見つからないため、依存関係をインストールします...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install に失敗しました。
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo [WARN] .env が見つかりません。API_KEY を設定した .env を作成してください。
  echo [WARN] そのまま起動は試行しますが、AI機能は動作しない可能性があります。
)

echo [INFO] 開発サーバーを起動します...
call npm run dev

if errorlevel 1 (
  echo [ERROR] 起動に失敗しました。
  pause
  exit /b 1
)

endlocal
