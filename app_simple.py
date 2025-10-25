#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哼歌编曲后端API - 简化版本
暂时不使用BasicPitch，使用librosa进行基础音频分析
"""

from flask import Flask, request, jsonify
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

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
UPLOAD_FOLDER = 'temp_uploads'
ALLOWED_EXTENSIONS = {'webm', 'wav', 'mp3', 'm4a'}

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def convert_webm_to_wav(webm_path, wav_path):
    """将WebM音频转换为WAV格式"""
    try:
        # 尝试多种方法加载音频
        y, sr = None, None
        
        # 方法1: 直接使用librosa
        try:
            y, sr = librosa.load(webm_path, sr=22050)
        except:
            # 方法2: 使用ffmpeg-python (如果可用)
            try:
                import subprocess
                import tempfile
                
                # 使用ffmpeg转换
                temp_wav = tempfile.mktemp(suffix='.wav')
                subprocess.run([
                    'ffmpeg', '-i', webm_path, '-ac', '1', '-ar', '22050', 
                    '-y', temp_wav
                ], check=True, capture_output=True)
                
                y, sr = librosa.load(temp_wav, sr=22050)
                os.remove(temp_wav)
            except:
                # 方法3: 使用pydub
                try:
                    from pydub import AudioSegment
                    audio = AudioSegment.from_file(webm_path)
                    audio = audio.set_frame_rate(22050).set_channels(1)
                    audio.export(wav_path, format="wav")
                    y, sr = librosa.load(wav_path, sr=22050)
                except:
                    raise Exception("所有音频转换方法都失败了")
        
        if y is not None and sr is not None:
            # 保存为WAV
            sf.write(wav_path, y, sr)
            return True
        else:
            return False
            
    except Exception as e:
        print(f"音频转换失败: {e}")
        return False

def extract_melody_with_librosa(audio_path):
    """使用librosa进行基础旋律提取"""
    try:
        # 加载音频
        y, sr = librosa.load(audio_path, sr=22050)
        
        # 音高检测
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.1)
        
        # 提取主要音高
        notes = []
        time_frames = pitches.shape[1]
        hop_length = 512
        frame_time = hop_length / sr
        
        for t in range(time_frames):
            # 找到当前时间帧的主要音高
            pitch_values = pitches[:, t]
            magnitude_values = magnitudes[:, t]
            
            # 找到最强的音高
            if np.max(magnitude_values) > 0.1:  # 阈值过滤
                pitch_idx = np.argmax(magnitude_values)
                pitch_hz = pitch_values[pitch_idx]
                
                if pitch_hz > 0:  # 有效音高
                    # 转换为MIDI编号
                    midi_pitch = 12 * np.log2(pitch_hz / 440.0) + 69
                    midi_pitch = int(round(midi_pitch))
                    
                    # 限制在合理范围内
                    if 36 <= midi_pitch <= 96:  # C2到C7
                        notes.append({
                            'pitch': midi_pitch,
                            'start_time': t * frame_time,
                            'duration': frame_time,
                            'velocity': int(magnitude_values[pitch_idx] * 100)
                        })
        
        # 如果没有检测到音符，返回模拟数据
        if not notes:
            return {
                'success': False,
                'message': '未检测到清晰的旋律，使用模拟数据',
                'notes': generate_simulated_notes(len(y) / sr)
            }
        
        # 按时间排序并合并相近的音符
        notes = merge_similar_notes(notes)
        
        return {
            'success': True,
            'message': f'成功提取到 {len(notes)} 个音符',
            'notes': notes,
            'total_duration': max([note['start_time'] + note['duration'] for note in notes]) if notes else 0
        }
        
    except Exception as e:
        print(f"librosa处理失败: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'message': f'旋律提取失败: {str(e)}',
            'notes': []
        }

def generate_simulated_notes(duration):
    """生成模拟音符数据"""
    scale = [60, 62, 64, 65, 67, 69, 71, 72]  # C大调音阶
    notes = []
    current_time = 0
    
    note_count = max(4, int(duration * 2))  # 每秒2个音符
    
    for i in range(note_count):
        pitch = scale[i % len(scale)]
        note_duration = 0.5 if i % 3 != 0 else 1.0  # 每3个音符有一个长音符
        
        notes.append({
            'pitch': pitch,
            'start_time': current_time,
            'duration': note_duration,
            'velocity': 80
        })
        
        current_time += note_duration
    
    return notes

def merge_similar_notes(notes, time_threshold=0.1):
    """合并相近时间的音符"""
    if not notes:
        return notes
    
    merged = []
    current_note = notes[0]
    
    for note in notes[1:]:
        if note['start_time'] - current_note['start_time'] < time_threshold:
            # 合并音符，选择音高更稳定的
            if abs(note['pitch'] - current_note['pitch']) < 3:
                current_note['duration'] = note['start_time'] + note['duration'] - current_note['start_time']
                current_note['velocity'] = max(current_note['velocity'], note['velocity'])
            else:
                merged.append(current_note)
                current_note = note
        else:
            merged.append(current_note)
            current_note = note
    
    merged.append(current_note)
    return merged

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'message': '哼歌编曲API服务正常运行（简化版）',
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
        
        # 使用librosa提取旋律
        try:
            result = extract_melody_with_librosa(temp_wav_path)
        except Exception as e:
            print(f"旋律提取失败，使用模拟数据: {e}")
            # 如果提取失败，返回模拟数据
            duration = 4.0  # 默认4秒
            result = {
                'success': True,
                'message': '音频处理失败，使用模拟旋律数据',
                'notes': generate_simulated_notes(duration),
                'total_duration': duration
            }
        
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

if __name__ == '__main__':
    print("启动哼歌编曲API服务（简化版）...")
    print("API文档: http://localhost:5000/health")
    print("旋律提取: POST http://localhost:5000/extract-melody")
    app.run(debug=True, host='0.0.0.0', port=5000)
