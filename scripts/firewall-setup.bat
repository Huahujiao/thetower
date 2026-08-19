@echo off
:: 以管理员身份运行此脚本来添加防火墙规则
:: 右键 -> 以管理员身份运行，或在管理员终端中执行

echo 正在添加防火墙规则: 开放 TCP 3000 端口 (Vite Dev Server)...

netsh advfirewall firewall add rule name="Vite Dev Port 3000" dir=in action=allow protocol=TCP localport=3000

if %errorlevel% equ 0 (
    echo.
    echo [成功] 防火墙规则已添加，TCP 3000 端口已开放。
) else (
    echo.
    echo [失败] 请确保以管理员身份运行此脚本。
)

echo.
pause
