@echo off
setlocal
chcp 65001 >nul
title TaskHub

rem ====== ADAPTEZ CE CHEMIN ======
cd /d "C:\Users\Antoine\OneDrive\01-ANTOINE\03_PROJETS\09_APP-brainy\Brainy_App"

echo ============================================
echo   TaskHub - mise a jour et lancement
echo ============================================

rem --- Verification que c'est bien un depot git ---
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [X] Ce dossier n'est pas un depot git.
    pause
    exit /b 1
)

rem --- Rappel de la branche de travail ---
for /f "delims=" %%B in ('git branch --show-current') do echo Branche : %%B

echo.
echo [1/3] Recuperation des mises a jour...
git fetch origin
git pull --ff-only origin vibe/taskhub-app-65da77
if errorlevel 1 (
    echo [X] Echec du git pull (modifications locales ?).
    echo     - Pour ecraser vos modifs locales : git reset --hard origin/vibe/taskhub-app-65da77
    echo     - Pour les garder : git stash puis relancez
    pause
    exit /b 1
)

rem --- Reinstallation des dependances si le commit a change ---
set "LAST="
if exist ".last-update" set /p LAST=<.last-update
for /f "delims=" %%H in ('git rev-parse HEAD') do set "CURRENT=%%H"
if not "%LAST%"=="%CURRENT%" (
    echo [2/3] Nouvelle version detectee : mise a jour des dependances...
    call npm run install:all
    if errorlevel 1 (
        echo [X] Echec de l'installation des dependances.
        pause
        exit /b 1
    )
    echo %CURRENT%> .last-update
) else (
    echo [2/3] Dependances a jour.
)

if not exist ".env" (
    echo [!] Fichier .env absent - copiez .env.example vers .env pour la meteo/mail.
)

echo.
echo [3/3] Lancement de l'application...
echo     Dashboard : http://localhost:5173  (une fois tout demarre)
echo     Arret : fermez cette fenetre ou Ctrl+C
echo.
call npm run dev
pause