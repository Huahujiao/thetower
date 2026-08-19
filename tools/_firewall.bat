@echo off
netsh advfirewall firewall delete rule name=HeitaLogReceiver7700 >nul 2>&1
netsh advfirewall firewall add rule name=HeitaLogReceiver7700 dir=in action=allow protocol=TCP localport=7700
