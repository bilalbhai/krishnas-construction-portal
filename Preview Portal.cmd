@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node scripts/serve.mjs --open
) else (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts/serve.mjs --open
  ) else (
    echo Install Node.js LTS, then open this file again.
    pause
  )
)
if errorlevel 1 pause
