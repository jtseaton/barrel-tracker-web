@echo off
echo Starting rebuild and push process...

cd client
echo Clearing old build...
del /Q build\* 2>nul

echo Building client...
npm install && set NODE_OPENSSL_LEGACY_PROVIDER=1 && npm run build
if %ERRORLEVEL% NEQ 0 (
  echo Build failed! Check errors above.
  pause
  exit /b %ERRORLEVEL%
)

echo Committing changes...
cd ..
git add client/src/App.tsx client/src/App.css client/build
git commit -m "Slide-out menu and move forms to Inventory"
if %ERRORLEVEL% NEQ 0 (
  echo Commit failed! Check Git status.
  pause
  exit /b %ERRORLEVEL%
)

echo Pushing to origin main...
git push origin main
if %ERRORLEVEL% NEQ 0 (
  echo Push failed! Check Git output.
  pause
  exit /b %ERRORLEVEL%
)

echo Done! Check Render deploy.
pause