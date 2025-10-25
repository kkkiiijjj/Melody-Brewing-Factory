// Strudel 集成 Demo - 核心逻辑
// 移除静态命名导入，改为在播放时动态导入，避免导出名不匹配导致报错
// import { Strudel } from 'https://cdn.jsdelivr.net/npm/@strudel/core/+esm';

// 全局变量
let strudelInstance = null;
let currentPattern = null;
let isPlaying = false;
let activeToneParts = [];
let StrudelCore = null; // 动态导入的核心模块缓存

// 示例旋律数据（模拟从音频提取的结果）
const exampleMelodies = {
    simple: [
        { pitch: 60, start_time: 0, duration: 0.5, velocity: 80 }, // C4
        { pitch: 62, start_time: 0.5, duration: 0.5, velocity: 80 }, // D4
        { pitch: 64, start_time: 1.0, duration: 0.5, velocity: 80 }, // E4
        { pitch: 65, start_time: 1.5, duration: 0.5, velocity: 80 }, // F4
        { pitch: 67, start_time: 2.0, duration: 1.0, velocity: 90 }, // G4
        { pitch: 67, start_time: 3.0, duration: 1.0, velocity: 90 }, // G4
    ],
    
    happy: [
        { pitch: 64, start_time: 0, duration: 0.25, velocity: 80 }, // E4
        { pitch: 67, start_time: 0.25, duration: 0.25, velocity: 80 }, // G4
        { pitch: 69, start_time: 0.5, duration: 0.5, velocity: 85 }, // A4
        { pitch: 67, start_time: 1.0, duration: 0.25, velocity: 80 }, // G4
        { pitch: 69, start_time: 1.25, duration: 0.25, velocity: 80 }, // A4
        { pitch: 72, start_time: 1.5, duration: 1.0, velocity: 90 }, // C5
    ],
    
    sad: [
        { pitch: 60, start_time: 0, duration: 1.0, velocity: 70 }, // C4
        { pitch: 58, start_time: 1.0, duration: 0.5, velocity: 75 }, // A#3
        { pitch: 57, start_time: 1.5, duration: 0.5, velocity: 80 }, // A3
        { pitch: 55, start_time: 2.0, duration: 2.0, velocity: 85 }, // G3
    ]
};

// 工具函数：MIDI 编号转音名
function midiToNoteName(midiNumber) {
    const notes = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return notes[noteIndex] + octave;
}

// 工具函数：时长转 Strudel 时长符号
function durationToSymbol(duration, bpm = 120) {
    const beatDuration = 60 / bpm; // 一拍多少秒
    const ratio = duration / beatDuration;
    
    if (ratio <= 0.125) return '!';      // 三十二分音符
    if (ratio <= 0.25) return '.';       // 十六分音符  
    if (ratio <= 0.5) return '';         // 八分音符
    if (ratio <= 0.75) return 't';       // 附点八分音符
    if (ratio <= 1.0) return '_';        // 四分音符
    if (ratio <= 1.5) return 't_';       // 附点四分音符
    if (ratio <= 2.0) return '__';       // 二分音符
    return '___';                        // 全音符
}

// 核心函数：旋律转 Strudel 模式
function melodyToStrudelPattern(melodyNotes, bpm = 120, instrument = 'piano') {
    if (!melodyNotes || melodyNotes.length === 0) {
        return '~'; // 空模式
    }
    
    const noteStrings = melodyNotes.map(note => {
        const noteName = midiToNoteName(note.pitch);
        const durationSym = durationToSymbol(note.duration, bpm);
        return noteName + durationSym;
    });
    
    return `sound("${instrument}").note("${noteStrings.join(' ')}")`;
}

// 生成和弦进行
function generateChordProgression(key = 'C', progression = 'I-V-vi-IV') {
    const chords = {
        'C': { 'I': 'c4', 'V': 'g4', 'vi': 'a4', 'IV': 'f4' },
        'G': { 'I': 'g4', 'V': 'd4', 'vi': 'e4', 'IV': 'c4' },
        'F': { 'I': 'f4', 'V': 'c4', 'vi': 'd4', 'IV': 'a4' }
    };
    
    const keyChords = chords[key] || chords['C'];
    const progressionChords = progression.split('-').map(roman => keyChords[roman]);
    
    return `sound("pad").chord("${progressionChords.join(' ')}").gain(0.3)`;
}

// ============== UI 绑定与播放逻辑 ==============

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initPixelAnimation();
});

// 像素风动画系统
function initPixelAnimation() {
    const pixelContainer = document.getElementById('pixelAnimation');
    if (!pixelContainer) return;
    
    // 创建像素点
    function createPixelDots() {
        const numDots = 50;
        for (let i = 0; i < numDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'pixel-dot';
            dot.style.left = Math.random() * 100 + '%';
            dot.style.top = Math.random() * 100 + '%';
            dot.style.animationDelay = Math.random() * 3 + 's';
            dot.style.animationDuration = (2 + Math.random() * 2) + 's';
            pixelContainer.appendChild(dot);
        }
    }
    
    // 根据音乐状态更新动画
    function updatePixelAnimation(isPlaying, isRecording) {
        const dots = pixelContainer.querySelectorAll('.pixel-dot');
        dots.forEach((dot, index) => {
            if (isPlaying) {
                // 播放时：更活跃的动画
                dot.style.animationDuration = '0.5s';
                dot.style.background = `hsl(${(index * 30) % 360}, 70%, 60%)`;
            } else if (isRecording) {
                // 录音时：红色脉冲
                dot.style.animationDuration = '1s';
                dot.style.background = 'rgba(255, 100, 100, 0.8)';
            } else {
                // 静止时：缓慢浮动
                dot.style.animationDuration = '3s';
                dot.style.background = 'rgba(255, 255, 255, 0.1)';
            }
        });
    }
    
    // 暴露更新函数到全局
    window.updatePixelAnimation = updatePixelAnimation;
    
    createPixelDots();
}

function initUI() {
const $ = (id) => document.getElementById(id);

const melodyDisplayEl = $('melodyDisplay');
const strudelCodeEl = $('strudelCode');
const playbackStatusEl = $('playbackStatus');

const loadExampleBtn = $('loadExample');
const generateRandomBtn = $('generateRandom');
const convertBtn = $('convertToStrudel');
const playBtn = $('playMusic');
const stopBtn = $('stopMusic');
const exportBtn = $('exportCode');
const fullBtn = $('loadFullArrangement');

// 录音相关元素
const startRecordBtn = $('startRecording');
const stopRecordBtn = $('stopRecording');
const playRecordBtn = $('playRecording');
const recordingStatusEl = $('recordingStatus');
const audioVisualizerEl = $('audioVisualizer');
const waveformCanvas = $('waveformCanvas');

let currentMelody = [];
let currentStrudelCode = '';

// 录音相关变量
let mediaRecorder = null;
let audioChunks = [];
let recordedAudioBlob = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let isRecording = false;
let recordingStartTime = 0;

function setStatus(text, type = 'info') {
    if (!playbackStatusEl) return;
    playbackStatusEl.style.display = 'block';
    playbackStatusEl.className = `status ${type}`;
    playbackStatusEl.textContent = text;
}

function enableControls(afterMelodyLoaded = false, afterCodeGen = false) {
    if (afterMelodyLoaded) {
        convertBtn.disabled = false;
    }
    if (afterCodeGen) {
        playBtn.disabled = false;
        stopBtn.disabled = false;
        exportBtn.disabled = false;
    }
}

function showCodeBlock(el, codeObj) {
    el.style.display = 'block';
    el.textContent = JSON.stringify(codeObj, null, 2);
}

// ============== 录音功能实现 ==============

function setRecordingStatus(text, type = 'info') {
    if (!recordingStatusEl) return;
    recordingStatusEl.style.display = 'block';
    recordingStatusEl.className = `status ${type}`;
    recordingStatusEl.textContent = text;
}

// 初始化音频上下文和可视化
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
    }
    return audioContext;
}

// 开始录音
async function startRecording() {
    try {
        setRecordingStatus('正在请求麦克风权限...', 'info');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        // 初始化音频上下文
        await initAudioContext();
        
        // 设置录音器
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunks = [];
        
        // 录音数据收集
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        // 录音结束处理
        mediaRecorder.onstop = () => {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const duration = Math.round((Date.now() - recordingStartTime) / 1000);
            setRecordingStatus(`录音完成！时长: ${duration}秒`, 'success');
            stopRecordBtn.disabled = true;
            playRecordBtn.disabled = false;
            startRecordBtn.disabled = false;
            startRecordBtn.classList.remove('recording');
            
            // 显示音频可视化
            showAudioVisualization();
            
            // 模拟从录音提取旋律（这里用随机旋律代替真实分析）
            setTimeout(() => {
                console.log('开始旋律提取流程...');
                // 暂时直接使用模拟数据，避免后端问题
                extractMelodySimulation(duration);
                // extractMelodyFromRecording(duration);
            }, 1000);
        };
        
        // 开始录音
        mediaRecorder.start(100); // 每100ms收集一次数据
        recordingStartTime = Date.now();
        isRecording = true;
        
        // 更新UI状态
        startRecordBtn.disabled = true;
        stopRecordBtn.disabled = false;
        startRecordBtn.classList.add('recording');
        setRecordingStatus('正在录音... 点击停止录音', 'success');
        
        // 开始音频可视化
        startAudioVisualization(stream);
        
        // 触发像素动画
        if (window.updatePixelAnimation) {
            window.updatePixelAnimation(false, true);
        }
        
    } catch (error) {
        console.error('录音失败:', error);
        setRecordingStatus('录音失败: ' + error.message, 'error');
        resetRecordingUI();
    }
}

// 停止录音
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        // 停止所有音频轨道
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        // 停止音频可视化
        stopAudioVisualization();
    }
}

// 播放录音
function playRecording() {
    if (recordedAudioBlob) {
        const audioUrl = URL.createObjectURL(recordedAudioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };
        
        setRecordingStatus('正在播放录音...', 'info');
    }
}

// 音频可视化
function startAudioVisualization(stream) {
    if (!audioContext || !analyser) return;
    
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    
    audioVisualizerEl.style.display = 'block';
    drawWaveform();
}

function stopAudioVisualization() {
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    audioVisualizerEl.style.display = 'none';
}

function drawWaveform() {
    if (!isRecording || !analyser || !waveformCanvas) return;
    
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // 像素风设置
    ctx.imageSmoothingEnabled = false;
    
    function draw() {
        if (!isRecording) return;
        
        requestAnimationFrame(draw);
        
        analyser.getByteFrequencyData(dataArray);
        
        // LOFI风格背景
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 添加网格线
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        const barWidth = Math.max(2, (canvas.width / bufferLength) * 3);
        let x = 0;
        
        for (let i = 0; i < bufferLength; i += 2) { // 减少密度，更像素化
            const barHeight = (dataArray[i] / 255) * canvas.height;
            
            // LOFI色彩方案
            const hue = (i / bufferLength) * 60 + 200; // 蓝紫色调
            const saturation = 70 + (dataArray[i] / 255) * 30;
            const lightness = 40 + (dataArray[i] / 255) * 40;
            
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // 像素化绘制
            const pixelX = Math.floor(x / 4) * 4;
            const pixelY = Math.floor((canvas.height - barHeight) / 4) * 4;
            const pixelWidth = Math.ceil(barWidth / 4) * 4;
            const pixelHeight = Math.ceil(barHeight / 4) * 4;
            
            ctx.fillRect(pixelX, pixelY, pixelWidth, pixelHeight);
            
            x += barWidth + 2;
        }
        
        // 添加扫描线效果
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fillRect(0, canvas.height / 2, canvas.width, 2);
    }
    
    draw();
}

function showAudioVisualization() {
    if (recordedAudioBlob) {
        // 这里可以添加更复杂的音频分析
        // 比如显示录音的波形图
        audioVisualizerEl.style.display = 'block';
    }
}

function resetRecordingUI() {
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
    playRecordBtn.disabled = true;
    startRecordBtn.classList.remove('recording');
    audioVisualizerEl.style.display = 'none';
}

// 从录音提取旋律（调用后端API）
async function extractMelodyFromRecording(duration) {
    console.log('开始提取旋律，录音时长:', duration);
    setRecordingStatus('正在分析录音，提取旋律...', 'info');
    
    try {
        // 检查后端服务是否可用
        console.log('检查后端服务...');
        const healthResponse = await fetch('http://localhost:5000/health');
        if (!healthResponse.ok) {
            throw new Error('后端服务不可用，请确保已启动后端服务');
        }
        console.log('后端服务正常');
        
        // 准备FormData上传音频文件
        const formData = new FormData();
        formData.append('audio', recordedAudioBlob, 'recording.webm');
        
        setRecordingStatus('正在上传音频到后端...', 'info');
        
        // 调用后端API
        const response = await fetch('http://localhost:5000/extract-melody', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('后端返回结果:', result);
        
        if (result.success) {
            // 成功提取旋律
            currentMelody = result.notes;
            console.log('提取到的旋律:', currentMelody);
            showCodeBlock(melodyDisplayEl, currentMelody);
            setRecordingStatus(`旋律提取完成！检测到 ${result.notes.length} 个音符`, 'success');
            setStatus('已从录音提取旋律，可生成 Strudel 代码');
            enableControls(true, false);
        } else {
            // 提取失败
            console.log('旋律提取失败:', result.message);
            setRecordingStatus(`旋律提取失败: ${result.message}`, 'error');
            setStatus('旋律提取失败，请尝试重新录音或使用示例数据');
        }
        
    } catch (error) {
        console.error('旋律提取错误:', error);
        console.error('错误详情:', error.stack);
        
        // 如果后端不可用，回退到模拟模式
        if (error.message.includes('后端服务不可用') || error.message.includes('Failed to fetch')) {
            console.log('后端不可用，使用模拟模式');
            setRecordingStatus('后端服务不可用，使用模拟模式...', 'info');
            extractMelodySimulation(duration);
        } else {
            console.log('其他错误，使用模拟模式');
            setRecordingStatus(`旋律提取失败: ${error.message}，使用模拟模式`, 'error');
            extractMelodySimulation(duration);
        }
    }
}

// 模拟旋律提取（后端不可用时的回退方案）
function extractMelodySimulation(duration) {
    console.log('使用模拟旋律提取，录音时长:', duration);
    setRecordingStatus('正在生成模拟旋律...', 'info');
    
    setTimeout(() => {
        console.log('开始生成模拟旋律...');
        // 根据录音时长生成相应数量的音符
        const noteCount = Math.max(4, Math.floor(duration * 2)); // 每秒2个音符
        const scale = [60, 62, 64, 65, 67, 69, 71, 72]; // C大调音阶
        const extractedMelody = [];
        
        let currentTime = 0;
        for (let i = 0; i < noteCount; i++) {
            const pitch = scale[Math.floor(Math.random() * scale.length)];
            const noteDuration = Math.random() < 0.3 ? 1.0 : 0.5; // 30%概率长音符
            
            extractedMelody.push({
                pitch: pitch,
                start_time: currentTime,
                duration: noteDuration,
                velocity: 70 + Math.random() * 30 // 70-100力度
            });
            
            currentTime += noteDuration;
        }
        
        console.log('生成的模拟旋律:', extractedMelody);
        
        // 更新当前旋律
        currentMelody = extractedMelody;
        showCodeBlock(melodyDisplayEl, currentMelody);
        setRecordingStatus(`模拟旋律提取完成！生成了 ${extractedMelody.length} 个音符`, 'success');
        setStatus('已从录音提取旋律，可生成 Strudel 代码');
        enableControls(true, false);
        
        console.log('模拟旋律提取完成，界面应该已更新');
        
    }, 2000); // 模拟2秒分析时间
}

// 录音按钮事件绑定
startRecordBtn?.addEventListener('click', startRecording);
stopRecordBtn?.addEventListener('click', stopRecording);
playRecordBtn?.addEventListener('click', playRecording);

// 1) 加载示例旋律
loadExampleBtn?.addEventListener('click', () => {
    currentMelody = exampleMelodies.happy;
    showCodeBlock(melodyDisplayEl, currentMelody);
    setStatus('已加载示例旋律，可生成 Strudel 代码');
    enableControls(true, false);
});

// 2) 生成随机旋律（简单随机在C大调内）
generateRandomBtn?.addEventListener('click', () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72];
    const notes = [];
    let t = 0;
    for (let i = 0; i < 8; i++) {
        const pitch = scale[Math.floor(Math.random() * scale.length)];
        const duration = Math.random() < 0.3 ? 1.0 : 0.5;
        notes.push({ pitch, start_time: t, duration, velocity: 80 });
        t += duration;
    }
    currentMelody = notes;
    showCodeBlock(melodyDisplayEl, currentMelody);
    setStatus('已生成随机旋律，可生成 Strudel 代码');
    enableControls(true, false);
});

// 3) 转换为 Strudel 代码
convertBtn?.addEventListener('click', () => {
    const bpm = 120;
    const melodyPattern = melodyToStrudelPattern(currentMelody, bpm, 'piano');
    const chordPattern = generateChordProgression('C', 'I-V-vi-IV');
    currentStrudelCode = `${melodyPattern} + ${chordPattern}`;
    strudelCodeEl.style.display = 'block';
    strudelCodeEl.textContent = currentStrudelCode;
    setStatus('已生成 Strudel 代码，可播放');
    enableControls(false, true);
});

// 4) 播放逻辑：优先 Strudel，失败回退 Tone.js
async function playWithStrudel() {
    try {
        if (!StrudelCore) {
            StrudelCore = await import('https://cdn.jsdelivr.net/npm/@strudel/core/+esm');
        }
        // 兼容多种导出形式：eval / default.eval / run / interpret
        const maybeEval = StrudelCore.eval || (StrudelCore.default && StrudelCore.default.eval) || StrudelCore.run || StrudelCore.interpret;
        if (typeof maybeEval === 'function') {
            await maybeEval(currentStrudelCode);
            isPlaying = true;
            setStatus('使用 Strudel 播放中...', 'success');
            return true;
        }
        return false;
    } catch (e) {
        console.warn('Strudel 播放失败，回退 Tone.js', e);
        return false;
    }
}

function clearToneParts() {
    activeToneParts.forEach(p => p.dispose());
    activeToneParts = [];
}

async function playWithTone() {
    if (!currentMelody?.length) return;
    if (typeof Tone === 'undefined') {
        setStatus('Tone.js 未加载，无法播放', 'error');
        return;
    }
    await Tone.start();
    Tone.Transport.bpm.value = 120;
    clearToneParts();

    // 创建高质量音色和效果链
    const masterReverb = new Tone.Reverb({
        decay: 2.5,
        wet: 0.3
    }).toDestination();
    
    const masterCompressor = new Tone.Compressor({
        threshold: -20,
        ratio: 4,
        attack: 0.1,
        release: 0.1
    }).connect(masterReverb);

    // 1. 主旋律 - 更丰富的音色
    const melodySynth = new Tone.Synth({
        oscillator: { 
            type: 'sawtooth',
            modulationFrequency: 0.5,
            modulationIndex: 2
        },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.0 }
    });
    
    const melodyFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 2000,
        rolloff: -12
    });
    
    const melodyDelay = new Tone.PingPongDelay({
        delayTime: '8n',
        feedback: 0.2,
        wet: 0.1
    });
    
    melodySynth.chain(melodyFilter, melodyDelay, masterCompressor);

    // 2. 和弦 - 温暖的pad音色
    const chordSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { 
            type: 'sine',
            modulationFrequency: 0.3,
            modulationIndex: 1
        },
        envelope: { attack: 0.8, decay: 0.4, sustain: 0.6, release: 2.0 }
    });
    
    const chordFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 1500,
        rolloff: -24
    });
    
    const chordChorus = new Tone.Chorus({
        frequency: 1.5,
        delayTime: 3.5,
        depth: 0.7,
        wet: 0.3
    });
    
    chordSynth.chain(chordFilter, chordChorus, masterCompressor);

    // 3. 贝斯 - 更厚实的低音
    const bassSynth = new Tone.Synth({
        oscillator: { 
            type: 'triangle',
            modulationFrequency: 0.2,
            modulationIndex: 3
        },
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 0.8 }
    });
    
    const bassFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 800,
        rolloff: -12
    });
    
    const bassDistortion = new Tone.Distortion(0.1);
    
    bassSynth.chain(bassFilter, bassDistortion, masterCompressor);

    // 4. 鼓组 - 更专业的鼓音色
    const kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.01, release: 1.4 }
    }).connect(masterCompressor);
    
    const snare = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }
    });
    
    const snareFilter = new Tone.Filter({
        type: 'highpass',
        frequency: 200
    });
    
    snare.chain(snareFilter, masterCompressor);
    
    const hihat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.01, release: 0.1 }
    });
    
    const hihatFilter = new Tone.Filter({
        type: 'highpass',
        frequency: 7000
    });
    
    hihat.chain(hihatFilter, masterCompressor);

    // 1. 主旋律 (更亮的音色)
    const melodyEvents = currentMelody.map(n => ({
        time: n.start_time,
        note: Tone.Frequency(n.pitch, 'midi').toNote(),
        dur: n.duration
    }));

    const melodyPart = new Tone.Part((time, ev) => {
        melodySynth.triggerAttackRelease(ev.note, ev.dur, time, 0.9);
    }, melodyEvents).start(0);
    activeToneParts.push(melodyPart);

    // 2. 智能和弦进行 - 根据旋律动态生成
    const melodyDuration = Math.max(16, currentMelody.reduce((max, note) => 
        Math.max(max, note.start_time + note.duration), 0));
    
    // 更丰富的和弦库
    const chordLibrary = {
        'C': [
            ['C3', 'E3', 'G3', 'C4'], // C大三和弦
            ['C3', 'E3', 'G3', 'B3'], // C大七和弦
            ['C3', 'F3', 'G3', 'C4'], // Csus4
        ],
        'G': [
            ['G2', 'B2', 'D3', 'G3'], // G大三和弦
            ['G2', 'B2', 'D3', 'F#3'], // G大七和弦
            ['G2', 'C3', 'D3', 'G3'], // Gsus4
        ],
        'Am': [
            ['A2', 'C3', 'E3', 'A3'], // Am小三和弦
            ['A2', 'C3', 'E3', 'G3'], // Am7
            ['A2', 'D3', 'E3', 'A3'], // Asus4
        ],
        'F': [
            ['F2', 'A2', 'C3', 'F3'], // F大三和弦
            ['F2', 'A2', 'C3', 'E3'], // F大七和弦
            ['F2', 'Bb2', 'C3', 'F3'], // Fsus4
        ]
    };
    
    const chordProgression = [];
    const chordSequence = ['C', 'G', 'Am', 'F'];
    
    for (let i = 0; i < melodyDuration; i += 2) {
        const chordIndex = Math.floor(i / 2) % 4;
        const chordName = chordSequence[chordIndex];
        const chordVariations = chordLibrary[chordName];
        
        // 随机选择和弦变化
        const selectedChord = chordVariations[Math.floor(Math.random() * chordVariations.length)];
        chordProgression.push({ time: i, chord: selectedChord });
    }

    const chordPart = new Tone.Part((time, ev) => {
        chordSynth.triggerAttackRelease(ev.chord, 2, time, 0.8); // 增加和弦音量
    }, chordProgression).start(0);
    activeToneParts.push(chordPart);

    // 3. 贝斯线 (根音贝斯) - 根据旋律长度动态生成
    const bassNotes = [];
    const bassRoots = ['C2', 'G2', 'A2', 'F2'];
    for (let i = 0; i < melodyDuration; i += 2) {
        const bassIndex = Math.floor(i / 2) % 4;
        bassNotes.push({ time: i, note: bassRoots[bassIndex], dur: 2 });
    }

    const bassPart = new Tone.Part((time, ev) => {
        bassSynth.triggerAttackRelease(ev.note, ev.dur, time, 0.7);
    }, bassNotes).start(0);
    activeToneParts.push(bassPart);

    // 4. 智能鼓组 - 更复杂的节奏模式
    const drumPattern = [];
    
    // 多种鼓组模式
    const drumStyles = {
        'basic': {
            kick: [0, 2, 4, 6],
            snare: [1, 3, 5, 7],
            hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]
        },
        'complex': {
            kick: [0, 1.5, 2, 3.5, 4, 5.5, 6, 7.5],
            snare: [1, 3, 5, 7],
            hihat: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75, 7, 7.25, 7.5, 7.75]
        },
        'minimal': {
            kick: [0, 4],
            snare: [2, 6],
            hihat: [0, 1, 2, 3, 4, 5, 6, 7]
        }
    };
    
    // 根据旋律长度选择鼓组风格
    const style = melodyDuration > 20 ? 'complex' : melodyDuration > 10 ? 'basic' : 'minimal';
    const selectedStyle = drumStyles[style];
    
    // 生成鼓组模式
    for (let i = 0; i < melodyDuration; i += 0.25) {
        const beat = i % 8;
        
        // Kick
        if (selectedStyle.kick.includes(beat)) {
            drumPattern.push({ time: i, type: 'kick' });
        }
        
        // Snare
        if (selectedStyle.snare.includes(beat)) {
            drumPattern.push({ time: i, type: 'snare' });
        }
        
        // Hi-hat
        if (selectedStyle.hihat.includes(beat)) {
            drumPattern.push({ time: i, type: 'hihat' });
        }
    }

    const drumPart = new Tone.Part((time, ev) => {
        switch(ev.type) {
            case 'kick':
                kick.triggerAttackRelease('C1', '8n', time, 0.8);
                break;
            case 'snare':
                snare.triggerAttackRelease('8n', time, 0.6);
                break;
            case 'hihat':
                hihat.triggerAttackRelease('32n', time, 0.3);
                break;
        }
    }, drumPattern).start(0);
    activeToneParts.push(drumPart);

    Tone.Transport.start();
    isPlaying = true;
    setStatus('使用 Tone.js 播放完整编曲中... (主旋律+和弦+贝斯+鼓组)', 'success');
    
    // 触发像素动画
    if (window.updatePixelAnimation) {
        window.updatePixelAnimation(true, false);
    }
}

async function handlePlay() {
    if (!currentStrudelCode) return;
    if (isPlaying) return;
    const ok = await playWithStrudel();
    if (!ok) {
        await playWithTone();
    }
}

function handleStop() {
    try {
        if (strudelInstance) {
            strudelInstance.stop?.();
        }
    } catch {}
    try {
        if (typeof Tone !== 'undefined') {
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            clearToneParts();
        }
    } catch {}
    isPlaying = false;
    setStatus('已停止');
    
    // 停止像素动画
    if (window.updatePixelAnimation) {
        window.updatePixelAnimation(false, false);
    }
}

playBtn?.addEventListener('click', handlePlay);
stopBtn?.addEventListener('click', handleStop);

// 5) 导出代码
exportBtn?.addEventListener('click', () => {
    const blob = new Blob([currentStrudelCode || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arrangement.strudel.txt';
    a.click();
    URL.revokeObjectURL(url);
});

// 6) 完整编曲示例代码展示
fullBtn?.addEventListener('click', () => {
    const full = `${melodyToStrudelPattern(exampleMelodies.simple, 120, 'piano')} + ${generateChordProgression('C')}`;
    const el = document.getElementById('fullArrangement');
    el.style.display = 'block';
    el.textContent = full;
});

} // 结束 initUI 函数