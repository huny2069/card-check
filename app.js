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
        const response = await fetch('drivers.csv');
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
                facingMode: 'environment', // Rear camera preferences
                width: { ideal: 4096 },    // Request highest possible resolution
                height: { ideal: 2160 }
            }
        });
        video.srcObject = stream;
    } catch (error) {
        console.error('Camera access denied:', error);
        alert('카메라 접근 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.');
    }
}


async function processFrame() {
    if (isProcessing) return;
    isProcessing = true;

    scanBtn.disabled = true;
    scanBtn.textContent = '분석중...';
    document.body.classList.add('scanning');
    statusEl.textContent = '이미지 분석 및 글자 인식 중...';

    // 1. Capture Image from Video (ROI Crop)
    // Use 'willReadFrequently: true' for better performance on frequent readbacks
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // We want to crop the center area where the box is.
    // The box is roughly 80% width and 30% height of the video container.
    const cropWidth = video.videoWidth * 0.8;
    const cropHeight = video.videoHeight * 0.3;
    const startX = (video.videoWidth - cropWidth) / 2;
    const startY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw only the cropped area to the canvas
    context.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // Preprocessing: Binarization (Thresholding)
    // This makes text sharp black and background white
    const imageData = context.getImageData(0, 0, cropWidth, cropHeight);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Grayscale calculation
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

        // Threshold: if darker than 135, make it black (0), else white (255)
        // Adjusted threshold for card text
        const threshold = 135;
        const color = avg < threshold ? 0 : 255;

        data[i] = color;     // R
        data[i + 1] = color; // G
        data[i + 2] = color; // B
    }
    context.putImageData(imageData, 0, 0);

    // Get Data URL
    const imageA = canvas.toDataURL('image/png');

    try {
        // 2. Perform OCR
        // Using Tesseract.js worker with both Korean and English models
        const worker = await Tesseract.createWorker(['kor', 'eng']);
        const ret = await worker.recognize(imageA);
        const text = ret.data.text;
        await worker.terminate();

        const cleanedText = text.replace(/\s+/g, ' ').trim();
        console.log('Recognized Text:', cleanedText);
        recognizedTextEl.textContent = cleanedText || '텍스트 인식 실패';

        // Debug: Show the processed image to the user for a moment
        canvas.style.display = 'block';
        setTimeout(() => { canvas.style.display = 'none'; }, 2000);

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
