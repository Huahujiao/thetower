@echo off
cd /d "%~dp0"
"%NODE_EXE%" "%~dp0log-server.mjs"
if not %errorlevel%==0 pause
