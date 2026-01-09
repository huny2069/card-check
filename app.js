// app.js

// Elements
const cameraInput = document.getElementById('camera-input');
const scanBtn = document.getElementById('scan-btn');
const previewImg = document.getElementById('preview-img');
const placeholderText = document.getElementById('placeholder-text');
const canvas = document.getElementById('canvas');
const resultContainer = document.getElementById('result-container');
const recognizedTextEl = document.getElementById('recognized-text');
const driverNameEl = document.getElementById('driver-name');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');

// State
let driverData = [];

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

// Simple CSV Parser
function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const data = [];
    let startLine = 0;
    if (lines[0] && lines[0].includes('키워드')) startLine = 1;

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
            data.push({
                keyword: parts[0].trim(),
                driver: parts[1].trim()
            });
        }
    }
    return data;
}

// 1. User clicks "Take Photo" -> Triggers hidden file input
scanBtn.addEventListener('click', () => {
    cameraInput.click();
});

// 2. User selects/takes photo -> Process it
cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading state
    scanBtn.disabled = true;
    scanBtn.textContent = '분석중...';
    statusEl.textContent = '사진을 분석하고 있습니다...';
    resultContainer.classList.remove('hidden');

    // Display Preview
    const imageUrl = URL.createObjectURL(file);
    previewImg.src = imageUrl;
    previewImg.style.display = 'block';
    placeholderText.style.display = 'none';

    // Process Image
    await processImage(imageUrl);
});

async function processImage(imageUrl) {
    try {
        // Tesseract Worker
        const worker = await Tesseract.createWorker(['kor', 'eng']);

        // Recognize directly from URL (Tesseract handles loading)
        const ret = await worker.recognize(imageUrl);
        const text = ret.data.text;
        await worker.terminate();

        const cleanedText = text.replace(/\s+/g, ' ').trim();
        console.log('Recognized Text:', cleanedText);
        recognizedTextEl.textContent = cleanedText || '텍스트 인식 실패';

        // Anchor Logic: Find text after "해운대" or "부산"
        const focusText = extractAddressAfterAnchor(cleanedText);

        if (focusText.length < cleanedText.length) {
            statusEl.textContent = `위치 찾음: ...${focusText.substring(0, 15)}...`;
        } else {
            statusEl.textContent = '전체 텍스트 검색 중...';
        }

        // Match Logic
        const match = findDriver(focusText);

        if (match) {
            driverNameEl.textContent = match.driver;
            driverNameEl.style.color = 'var(--primary-color)';
            statusEl.textContent = `'${match.keyword}' 매칭 성공!`;
            statusEl.style.backgroundColor = '#d4edda';
            statusEl.style.color = '#155724';
        } else {
            driverNameEl.textContent = '담당자 없음';
            driverNameEl.style.color = '#dc3545';
            statusEl.textContent = '주소 인식 실패 (데이터 확인 필요)';
            statusEl.style.backgroundColor = '#f8d7da';
            statusEl.style.color = '#721c24';
        }

    } catch (error) {
        console.error(error);
        alert('이미지 분석 중 오류가 발생했습니다.');
    } finally {
        scanBtn.disabled = false;
        scanBtn.textContent = '📷 다시 촬영하기';
    }
}

// Extract text after "해운대" or "부산"
function extractAddressAfterAnchor(text) {
    const haeundaeIndex = text.indexOf('해운대');
    if (haeundaeIndex !== -1) return text.substring(haeundaeIndex + 3).trim();

    const busanIndex = text.indexOf('부산');
    if (busanIndex !== -1) return text.substring(busanIndex + 2).trim();

    return text;
}

// Matching Algorithm (Normalized)
function findDriver(text) {
    if (!text) return null;
    const normalizedText = text.replace(/[\s\.\-\,]+/g, '');

    for (const rule of driverData) {
        const normalizedKeyword = rule.keyword.replace(/[\s\.\-\,]+/g, '');
        // Strict
        if (text.includes(rule.keyword)) return rule;
        // Fuzzy
        if (normalizedText.includes(normalizedKeyword)) {
            console.log(`Matched via normalization: ${rule.keyword}`);
            return rule;
        }
    }
    return null;
}

resetBtn.addEventListener('click', () => {
    cameraInput.value = '';
    previewImg.src = '';
    previewImg.style.display = 'none';
    placeholderText.style.display = 'flex';
    resultContainer.classList.add('hidden');

    recognizedTextEl.textContent = '-';
    driverNameEl.textContent = '-';
    statusEl.textContent = '대기중...';
    statusEl.style.backgroundColor = '#e9ecef';
    statusEl.style.color = '#333';
});

// Init
window.addEventListener('load', loadDriverData);
