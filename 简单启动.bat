@echo off
echo 简单启动哼歌编曲系统...
echo.

echo 安装依赖...
pip install flask flask-cors numpy scipy librosa soundfile

echo.
echo 启动服务...
python app_simple.py

pause
