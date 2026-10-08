@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

git push
if errorlevel 1 goto :fail_push

echo.
echo Push completed successfully.
endlocal
exit /b 0

:fail_push
echo.
echo FAILED: git push
echo The command output above contains the reason.
pause
exit /b 1
