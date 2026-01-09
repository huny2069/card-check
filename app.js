// app.js

// Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const scanBtn = document.getElementById('scan-btn');
const resultContainer = document.getElementById('result-container');
const recognizedTextEl = document.getElementById('recognized-text');
const driverNameEl = document.getElementById('driver-name');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');
const debugLog = document.getElementById('debug-log');

// State
let driverData = [];
let isProcessing = false;

// Load Driver Data (CSV)
async function loadDriverData() {
    try {
        const response = await fetch('data/drivers.csv');
        const text = await response.text();
        driverData = parseCSV(text);
        console.log(`Loaded ${driverData.length} rules from CSV.`);
    } catch (error) {
        console.error('Failed to load driver data:', error);
        alert('기사님 데이터(CSV)를 불러오는데 실패했습니다.');
    }
}

// Simple CSV Parser: "Keyword,DriverName"
function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const data = [];

    // Skip header if exists (checking if first line contains '키워드')
    let startLine = 0;
    if (lines[0] && lines[0].includes('키워드')) {
        startLine = 1;
    }

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const parts = line.split(',');
        if (parts.length >= 2) {
            // Assumes format: Keyword, DriverName
            const keyword = parts[0].trim();
            const driver = parts[1].trim();

            // Push individual rule
            data.push({
                keyword: keyword,
                driver: driver
            });
        }
    }
    return data;
}

// Camera Setup
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment' // Rear camera preference
            }
        });
        video.srcObject = stream;
    } catch (error) {
        console.error('Camera access denied:', error);
        alert('카메라 접근 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.');
    }
}

// Image Preprocessing (Simple Grayscale/Contrast)
function preprocessImage(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const contrast = 1.2; // Increase contrast
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const color = factor * (avg - 128) + 128;

        data[i] = color;     // Red
        data[i + 1] = color; // Green
        data[i + 2] = color; // Blue
    }

    ctx.putImageData(imageData, 0, 0);
}

// OCR and Matching Logic
async function processFrame() {
    if (isProcessing) return;
    isProcessing = true;

    scanBtn.disabled = true;
    scanBtn.textContent = '분석중...';
    document.body.classList.add('scanning');
    statusEl.textContent = '이미지 분석 및 글자 인식 중...';

    // 1. Capture Image from Video
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Optional: Crop to scan area (center)
    // For simplicity, we scan the whole frame or a center portion
    // Improving accuracy by cropping to the overlay area would be better for v2

    // Preprocessing
    preprocessImage(context, canvas.width, canvas.height);

    // Get Data URL
    const imageA = canvas.toDataURL('image/png');

    try {
        // 2. Perform OCR
        // Using Tesseract.js worker
        const worker = await Tesseract.createWorker('kor'); // Load Korean language
        const ret = await worker.recognize(imageA);
        const text = ret.data.text;
        await worker.terminate();

        const cleanedText = text.replace(/\s+/g, ' ').trim();
        console.log('Recognized Text:', cleanedText);
        recognizedTextEl.textContent = cleanedText || '텍스트 인식 실패';

        // 3. Match Driver
        const match = findDriver(cleanedText);

        if (match) {
            driverNameEl.textContent = match.driver;
            driverNameEl.style.color = 'var(--primary-color)';
            statusEl.textContent = '분류 완료!';
            statusEl.style.backgroundColor = '#d4edda';
            statusEl.style.color = '#155724';
        } else {
            driverNameEl.textContent = '담당자 없음 / 인식 불가';
            driverNameEl.style.color = '#dc3545';
            statusEl.textContent = '매칭 실패';
            statusEl.style.backgroundColor = '#f8d7da';
            statusEl.style.color = '#721c24';
        }

        // Show Results
        resultContainer.classList.remove('hidden');
        scanBtn.classList.add('hidden');

    } catch (error) {
        console.error('OCR Error:', error);
        alert('분석 중 오류가 발생했습니다.');
        statusEl.textContent = '오류 발생';
    } finally {
        isProcessing = false;
        scanBtn.disabled = false;
        scanBtn.textContent = '📷 주소 스캔하기';
        document.body.classList.remove('scanning');
    }
}

// Matching Algorithm
// Matching Algorithm
function findDriver(text) {
    if (!text) return null;

    // Check against all CSV rules
    for (const rule of driverData) {
        if (text.includes(rule.keyword)) {
            return rule;
        }
    }
    return null;
}

// Event Listeners
scanBtn.addEventListener('click', processFrame);

resetBtn.addEventListener('click', () => {
    resultContainer.classList.add('hidden');
    scanBtn.classList.remove('hidden');
    recognizedTextEl.textContent = '-';
    driverNameEl.textContent = '-';
    statusEl.textContent = '대기중...';
    statusEl.style.backgroundColor = '#e9ecef';
    statusEl.style.color = '#333';
});

// Initialization
window.addEventListener('load', () => {
    loadDriverData();
    startCamera();
});
