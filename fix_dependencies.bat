@echo off
echo 修复依赖安装问题...
echo.

REM 激活虚拟环境
call venv\Scripts\activate.bat

echo 1. 升级pip和setuptools...
python -m pip install --upgrade pip
python -m pip install --upgrade setuptools wheel

echo.
echo 2. 安装基础依赖...
pip install Flask Flask-CORS

echo.
echo 3. 安装音频处理依赖...
pip install numpy scipy

echo.
echo 4. 安装音频库...
pip install librosa soundfile

echo.
echo 5. 测试安装...
python -c "import flask; print('Flask安装成功')"
python -c "import librosa; print('librosa安装成功')"

echo.
echo 依赖安装完成！现在可以运行 start_backend.bat
pause
