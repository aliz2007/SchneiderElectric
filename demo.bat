@echo off
REM ============================================================
REM  APEX Assessment - Windows demo launcher
REM
REM  Double-click to run the full app locally with demo data.
REM  - Downloads the LATEST version from GitHub on every launch,
REM    so the demo always matches the current state of the app.
REM  - Installs dependencies + builds only when the code changed.
REM  - Needs Windows 10/11 (1803+) and an internet connection.
REM  Node.js is installed automatically via winget when missing.
REM ============================================================

setlocal
title APEX Assessment - Demo

set REPO=aliz2007/SchneiderElectric
set BRANCH=main
set ZIPURL=https://github.com/%REPO%/archive/refs/heads/%BRANCH%.zip
set WORK=%LOCALAPPDATA%\apex-assessment-demo
set ZIP=%WORK%\app.zip
set HASHFILE=%WORK%\version.txt
set PORT=3000

echo.
echo   ============================================
echo    APEX TOP 25 - Assessment app  ^(demo^)
echo   ============================================
echo.

REM ---------- 1. Node.js ----------
where node >nul 2>nul
if not errorlevel 1 goto node_ok

echo Node.js was not found on this PC.
where winget >nul 2>nul
if errorlevel 1 goto node_manual
echo Trying to install Node.js LTS automatically ^(winget^)...
echo.
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was installed, but this window cannot see it yet.
  echo Please CLOSE this window and double-click the file again.
  echo.
  pause
  exit /b 1
)
goto node_ok

:node_manual
echo Automatic installation is not available on this PC.
echo Please install Node.js LTS from https://nodejs.org ^(opens now^),
echo then run this file again.
start https://nodejs.org
echo.
pause
exit /b 1

:node_ok
echo [OK] Node.js:
node -v

REM ---------- 2. Download the latest app code ----------
if not exist "%WORK%" mkdir "%WORK%"
echo.
echo Downloading the latest version of the app...
curl -L -s -o "%ZIP%" "%ZIPURL%"
if errorlevel 1 goto download_failed
REM GitHub serves an HTML error page when something is wrong; a real zip starts with "PK"
findstr /m "PK" "%ZIP%" >nul 2>nul
if errorlevel 1 goto download_failed
echo [OK] Download complete.
goto hash_check

:download_failed
echo.
echo Download failed. Check your internet connection and try again.
echo If the problem persists, ask the project owner to confirm the
echo demo branch still exists: %BRANCH%
echo.
pause
exit /b 1

:hash_check
REM ---------- 3. Install + build only when the code changed ----------
for /f %%h in ('certutil -hashfile "%ZIP%" SHA256 ^| findstr /i /r "^[0-9a-f][0-9a-f]*$"') do set NEWHASH=%%h
set OLDHASH=none
if exist "%HASHFILE%" set /p OLDHASH=<"%HASHFILE%"

set SKIP=0
for /d %%d in ("%WORK%\SchneiderElectric-*") do (
  if "%OLDHASH%"=="%NEWHASH%" if exist "%%d\apex-assessment\node_modules" if exist "%%d\apex-assessment\.next" set SKIP=1
)
if "%SKIP%"=="1" (
  echo [OK] App is already up to date - skipping install and build.
  goto locate_app
)

echo.
echo New version detected - setting it up ^(this takes a few minutes
echo the first time: downloading libraries, then building the app^)...
echo.
tar -xf "%ZIP%" -C "%WORK%"
if errorlevel 1 (
  echo Failed to unpack the download.
  pause
  exit /b 1
)

:locate_app
set APP=
for /d %%d in ("%WORK%\SchneiderElectric-*") do set APP=%%d\apex-assessment
if not defined APP (
  echo Could not locate the app folder after unpacking.
  pause
  exit /b 1
)
if "%SKIP%"=="1" goto start_app

pushd "%APP%"
echo Installing libraries...
call npm ci --no-audit --no-fund
if errorlevel 1 goto npm_failed
echo.
echo Building the app...
call npm run build
if errorlevel 1 goto npm_failed
popd
echo %NEWHASH%>"%HASHFILE%"
echo.
echo [OK] Setup complete.
goto start_app

:npm_failed
echo.
echo Something went wrong during installation/build.
echo Send a photo of this window to the project owner.
popd
pause
exit /b 1

REM ---------- 4. Start the app with demo data ----------
:start_app
echo.
echo   ============================================
echo    The app is starting on your PC.
echo    Your browser will open automatically.
echo.
echo    Address:   http://localhost:%PORT%
echo    Login:     vladimir
echo    Password:  apex2026
echo.
echo    The demo is pre-filled with example ratings
echo    for all 25 Account Managers.
echo.
echo    To STOP the demo: close this window.
echo   ============================================
echo.
pushd "%APP%"
set APEX_DEMO=1
start "" cmd /c "timeout /t 7 >nul & start http://localhost:%PORT%"
call npm start -- -p %PORT%
popd
echo.
echo Demo stopped.
pause
