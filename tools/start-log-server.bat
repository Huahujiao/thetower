@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
set "TRACE=%~dp0_bat_trace.log"
echo [%date% %time%] BAT started > "%TRACE%"

set "NODE_EXE=node"
where node >> "%TRACE%" 2>&1
if errorlevel 1 (
  if exist "C:\Users\wu007\.workbuddy\binaries\node\versions\22.22.2\node.exe" (
    set "NODE_EXE=C:\Users\wu007\.workbuddy\binaries\node\versions\22.22.2\node.exe"
  ) else (
    echo Error: node not found. >> "%TRACE%"
    echo Error: node not found. Please install Node.js then retry.
    pause
    exit /b 1
  )
)
echo using NODE_EXE=%NODE_EXE% >> "%TRACE%"

rem Open firewall in a SEPARATE background window so it can never block or kill this script.
rem (succeeds only when run as admin; localhost still works without it)
start "HeitaFirewall" /min "%~dp0_firewall.bat"
echo firewall attempt launched in background. >> "%TRACE%"

netstat -ano 2>nul | findstr ":7700" | findstr "LISTEN" >nul
if %errorlevel% equ 0 (
  echo [WARN] port 7700 already in use - a previous instance may still be running.
)

echo Starting Heita log receiver (port 7700) in a separate window...
start "HeitaLog" "%~dp0_service.bat"
echo service start command issued. >> "%TRACE%"

timeout /t 2 >nul
netstat -ano 2>nul | findstr ":7700" | findstr "LISTEN" >nul
if %errorlevel% equ 0 (
  echo [OK] Log receiver is running. Close the "HeitaLog" window to stop it.
) else (
  echo [FAIL] Log receiver did not start. Check the "HeitaLog" window for errors.
)
echo This window can be closed; the service keeps running in the HeitaLog window.
pause >nul
