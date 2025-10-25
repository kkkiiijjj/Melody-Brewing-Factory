@echo off
echo 启动哼歌编曲后端服务...
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

REM 检查虚拟环境
if not exist "venv" (
    echo 创建虚拟环境...
    python -m venv venv
)

REM 激活虚拟环境
call venv\Scripts\activate.bat

REM 安装依赖
echo 安装依赖包...
pip install Flask Flask-CORS numpy scipy librosa soundfile

REM 启动服务
echo.
echo 启动Flask服务（简化版）...
echo API地址: http://localhost:5000
echo 健康检查: http://localhost:5000/health
echo.
python app_simple.py

pause
