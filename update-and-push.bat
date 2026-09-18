@echo off
setlocal
chcp 65001 >nul

git add .
if errorlevel 1 goto :fail_add

git commit -m "更新"
if errorlevel 1 goto :fail_commit

git push
if errorlevel 1 goto :fail_push

echo.
echo Update and push completed successfully.
pause
endlocal
exit /b 0

:fail_add
echo.
echo FAILED: git add .
echo The command output above contains the reason.
pause
exit /b 1

:fail_commit
echo.
echo FAILED: git commit
echo The command output above contains the reason.
pause
exit /b 1

:fail_push
echo.
echo FAILED: git push
echo The command output above contains the reason.
pause
exit /b 1
