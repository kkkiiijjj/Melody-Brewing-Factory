@echo off
echo 一键修复依赖问题...
echo.

REM 删除旧的虚拟环境
if exist "venv" (
    echo 删除旧的虚拟环境...
    rmdir /s /q venv
)

REM 创建新的虚拟环境
echo 创建新的虚拟环境...
python -m venv venv

REM 激活虚拟环境
echo 激活虚拟环境...
call venv\Scripts\activate.bat

REM 升级pip
echo 升级pip...
python -m pip install --upgrade pip

REM 安装setuptools
echo 安装setuptools...
python -m pip install setuptools wheel

REM 分步安装依赖
echo 安装Flask...
pip install Flask==2.3.3

echo 测试Flask安装...
python -c "import flask; print('Flask安装成功')" || (
    echo Flask安装失败，尝试全局安装...
    deactivate
    pip install Flask==2.3.3
    python -c "import flask; print('Flask全局安装成功')"
)

echo 安装其他依赖...
pip install Flask-CORS numpy scipy librosa soundfile

echo.
echo 测试所有依赖...
python -c "import flask, numpy, scipy, librosa, soundfile; print('所有依赖安装成功！')"

echo.
echo 修复完成！现在可以运行 start_backend.bat
pause
