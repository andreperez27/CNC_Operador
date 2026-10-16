@echo off
setlocal
rem CNC Operador - edicao offline (pen-drive).
rem Nao exige instalacao nem administrador e nao grava nada fora desta pasta:
rem o perfil do navegador fica em .\perfil (criada sozinha no primeiro uso).

set "BASE=%~dp0"
set "APP=%BASE%app\index.html"
if exist "%APP%" goto :haveapp
echo [ERRO] Nao encontrei o app em:
echo   "%APP%"
echo Copie esta pasta inteira do jeito que ela veio.
pause
exit /b 1

:haveapp
rem Monta file:/// com barras normais; espacos vao entre aspas
rem (Chrome, Edge e Firefox aceitam espacos em file:/// sem %20).
set "URL=%APP:\=/%"
set "URL=file:///%URL%"
set "PROFILE=%BASE%perfil"

rem 1) Firefox Portable na raiz (pastas FirefoxPortable*, ex. Legacy 115).
rem Procura App\Firefox64\firefox.exe (64 bits) ou App\Firefox\firefox.exe.
set "FFEXE="
for /D %%D in ("%BASE%FirefoxPortable*") do call :checkff "%%~D"
if defined FFEXE goto :usefirefox

rem 2) Chromium portatil em navegador\ (voce coloca, ver LEIA-ME.txt)
if exist "%BASE%navegador\chrome.exe" set "BROWSER=%BASE%navegador\chrome.exe"
if not defined BROWSER if exist "%BASE%navegador\msedge.exe" set "BROWSER=%BASE%navegador\msedge.exe"
if not defined BROWSER if exist "%BASE%navegador\chromium.exe" set "BROWSER=%BASE%navegador\chromium.exe"
if defined BROWSER goto :runapp

rem 3) Microsoft Edge instalado
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if defined BROWSER goto :runapp

rem 4) Google Chrome instalado
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if defined BROWSER goto :runapp

rem 5) Firefox instalado
if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" set "BROWSER=%ProgramFiles%\Mozilla Firefox\firefox.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" set "BROWSER=%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe"
if defined BROWSER goto :runapp

rem 6) navegador padrao do Windows
if defined CNC_DRYRUN goto :dryrun_default
start "" "%APP%"
if errorlevel 1 goto :nonavegador
exit /b 0

:dryrun_default
echo [DRYRUN] start "" "%APP%"
exit /b 0

:runapp
if defined CNC_DRYRUN goto :dryrun_app
start "" "%BROWSER%" --app="%URL%" --user-data-dir="%PROFILE%"
exit /b 0

:dryrun_app
echo [DRYRUN] "%BROWSER%" --app="%URL%" --user-data-dir="%PROFILE%"
exit /b 0

:checkff
rem %1 = pasta candidata (ex.: ...\FirefoxPortableLegacy115)
set "CAND=%~1"
if not exist "%CAND%\FirefoxPortable.exe" goto :eof
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" goto :checkff64
if defined PROCESSOR_ARCHITEW6432 goto :checkff64
echo [AVISO] Windows de 32 bits: este Firefox portatil exige Windows de 64 bits. Pulando.
goto :eof
:checkff64
if exist "%CAND%\App\Firefox64\firefox.exe" set "FFEXE=%CAND%\App\Firefox64\firefox.exe"
if not defined FFEXE if exist "%CAND%\App\Firefox\firefox.exe" set "FFEXE=%CAND%\App\Firefox\firefox.exe"
goto :eof

:usefirefox
rem Perfil separado do Firefox, dentro de perfil\firefox.
set "PFF=%PROFILE%\firefox"
if defined CNC_DRYRUN goto :dryrun_ff
if not exist "%PFF%" mkdir "%PFF%"
if exist "%PFF%\user.js" goto :runfirefox
echo user_pref("app.update.auto", false);>>"%PFF%\user.js"
echo user_pref("app.update.enabled", false);>>"%PFF%\user.js"
echo user_pref("app.update.checkInstallTime", false);>>"%PFF%\user.js"
echo user_pref("datareporting.healthreport.uploadEnabled", false);>>"%PFF%\user.js"
echo user_pref("datareporting.policy.dataSubmissionEnabled", false);>>"%PFF%\user.js"
echo user_pref("toolkit.telemetry.enabled", false);>>"%PFF%\user.js"
echo user_pref("toolkit.telemetry.unified", false);>>"%PFF%\user.js"
echo user_pref("browser.shell.checkDefaultBrowser", false);>>"%PFF%\user.js"
echo user_pref("browser.rights.3.shown", true);>>"%PFF%\user.js"
echo user_pref("browser.startup.homepage_override.mstone", "ignore");>>"%PFF%\user.js"
echo user_pref("browser.download.useDownloadDir", false);>>"%PFF%\user.js"
echo user_pref("browser.download.alwaysAskWhereToSave", true);>>"%PFF%\user.js"
:runfirefox
if defined CNC_DRYRUN goto :dryrun_ff
start "" "%FFEXE%" -no-remote -profile "%PFF%" "%URL%"
exit /b 0

:dryrun_ff
echo [DRYRUN] "%FFEXE%" -no-remote -profile "%PFF%" "%URL%"
exit /b 0

:nonavegador
echo [ERRO] Nenhum navegador encontrado.
echo Instale o Google Chrome ou coloque um Chromium portatil na pasta "navegador" (ver LEIA-ME.txt).
pause
exit /b 1
