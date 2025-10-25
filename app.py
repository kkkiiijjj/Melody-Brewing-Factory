#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哼歌编曲后端API
使用Flask + BasicPitch实现旋律提取
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import json
import numpy as np
from datetime import datetime
import traceback

# 音频处理库
import librosa
import soundfile as sf
from basic_pitch import BasicPitch
from basic_pitch.inference import predict_and_save

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
UPLOAD_FOLDER = 'temp_uploads'
ALLOWED_EXTENSIONS = {'webm', 'wav', 'mp3', 'm4a'}

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 初始化BasicPitch模型
print("正在加载BasicPitch模型...")
model = BasicPitch()
print("BasicPitch模型加载完成！")

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def convert_webm_to_wav(webm_path, wav_path):
    """将WebM音频转换为WAV格式"""
    try:
        # 使用librosa加载音频
        y, sr = librosa.load(webm_path, sr=22050)  # 降采样到22kHz提高处理速度
        
        # 保存为WAV
        sf.write(wav_path, y, sr)
        return True
    except Exception as e:
        print(f"音频转换失败: {e}")
        return False

def extract_melody_with_basicpitch(audio_path):
    """使用BasicPitch提取旋律"""
    try:
        # 使用BasicPitch进行音高检测
        model_output, midi_data, note_events = model.transcribe_file(audio_path)
        
        # 提取音符信息
        notes = []
        if note_events is not None and len(note_events) > 0:
            for note in note_events:
                notes.append({
                    'pitch': int(note.pitch),
                    'start_time': float(note.start_time),
                    'duration': float(note.end_time - note.start_time),
                    'velocity': int(note.velocity * 127)  # 转换为0-127范围
                })
        
        # 如果没有检测到音符，返回空结果
        if not notes:
            return {
                'success': False,
                'message': '未检测到清晰的旋律，请尝试哼唱更明显的音调',
                'notes': []
            }
        
        # 按时间排序
        notes.sort(key=lambda x: x['start_time'])
        
        return {
            'success': True,
            'message': f'成功提取到 {len(notes)} 个音符',
            'notes': notes,
            'total_duration': max([note['start_time'] + note['duration'] for note in notes]) if notes else 0
        }
        
    except Exception as e:
        print(f"BasicPitch处理失败: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'message': f'旋律提取失败: {str(e)}',
            'notes': []
        }

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'message': '哼歌编曲API服务正常运行',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/extract-melody', methods=['POST'])
def extract_melody():
    """旋律提取接口"""
    try:
        # 检查是否有文件上传
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'message': '未找到音频文件'
            }), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': '未选择文件'
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'message': '不支持的文件格式，请上传音频文件'
            }), 400
        
        # 生成临时文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        original_filename = file.filename
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        
        # 保存上传的文件
        temp_webm_path = os.path.join(UPLOAD_FOLDER, f'upload_{timestamp}.{file_extension}')
        file.save(temp_webm_path)
        
        # 转换为WAV格式（如果需要）
        temp_wav_path = os.path.join(UPLOAD_FOLDER, f'processed_{timestamp}.wav')
        
        if file_extension == 'webm':
            if not convert_webm_to_wav(temp_webm_path, temp_wav_path):
                return jsonify({
                    'success': False,
                    'message': '音频格式转换失败'
                }), 500
        else:
            # 其他格式直接复制
            import shutil
            shutil.copy2(temp_webm_path, temp_wav_path)
        
        # 使用BasicPitch提取旋律
        result = extract_melody_with_basicpitch(temp_wav_path)
        
        # 清理临时文件
        try:
            os.remove(temp_webm_path)
            os.remove(temp_wav_path)
        except:
            pass
        
        return jsonify(result)
        
    except Exception as e:
        print(f"API错误: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'服务器内部错误: {str(e)}'
        }), 500

@app.route('/process-audio', methods=['POST'])
def process_audio():
    """音频预处理接口（降噪、归一化等）"""
    try:
        if 'audio' not in request.files:
            return jsonify({'success': False, 'message': '未找到音频文件'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'success': False, 'message': '未选择文件'}), 400
        
        # 保存文件
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        temp_path = os.path.join(UPLOAD_FOLDER, f'process_{timestamp}.webm')
        file.save(temp_path)
        
        # 音频预处理
        y, sr = librosa.load(temp_path, sr=22050)
        
        # 降噪（简单的谱减法）
        y_denoised = librosa.effects.preemphasis(y)
        
        # 归一化
        y_normalized = librosa.util.normalize(y_denoised)
        
        # 端点检测（去除静音）
        intervals = librosa.effects.split(y_normalized, top_db=20)
        if len(intervals) > 0:
            y_trimmed = librosa.util.normalize(
                np.concatenate([y_normalized[start:end] for start, end in intervals])
            )
        else:
            y_trimmed = y_normalized
        
        # 保存处理后的音频
        processed_path = os.path.join(UPLOAD_FOLDER, f'processed_{timestamp}.wav')
        sf.write(processed_path, y_trimmed, sr)
        
        # 返回处理后的音频文件
        return send_file(processed_path, as_attachment=True, download_name='processed_audio.wav')
        
    except Exception as e:
        print(f"音频处理错误: {e}")
        return jsonify({
            'success': False,
            'message': f'音频处理失败: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("启动哼歌编曲API服务...")
    print("API文档: http://localhost:5000/health")
    print("旋律提取: POST http://localhost:5000/extract-melody")
    app.run(debug=True, host='0.0.0.0', port=5000)
