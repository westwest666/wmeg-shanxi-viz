@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   WMEG-Net 山西省可视化 · 本地服务器
echo   地址: http://127.0.0.1:8788/
echo   关闭本窗口即停止服务
echo ============================================
start "" http://127.0.0.1:8788/
python -m http.server 8788 --bind 127.0.0.1
pause
