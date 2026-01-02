// VERSION: 2.3 - Resilience Update (Render Fix)
document.addEventListener('DOMContentLoaded', () => {
    console.log('--- iPhone Clock Script v2.3 Loaded ---');
    initClock();
});

function initClock() {
    const timeElement = document.getElementById('time');
    const secondHand = document.querySelector('.second-hand');

    const now = new Date();
    const h12 = (now.getHours() % 12) || 12;
    const h = String(h12).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');

    previousTime = { hoursTens: h[0], hoursOnes: h[1], minutesTens: m[0], minutesOnes: m[1] };

    const els = {
        h1: document.getElementById('hours-tens'), h2: document.getElementById('hours-ones'),
        m1: document.getElementById('minutes-tens'), m2: document.getElementById('minutes-ones'),
        h1b: document.getElementById('hours-tens-new'), h2b: document.getElementById('hours-ones-new'),
        m1b: document.getElementById('minutes-tens-new'), m2b: document.getElementById('minutes-ones-new')
    };

    if (els.h1) { els.h1.textContent = h[0]; if (els.h1b) els.h1b.textContent = h[0]; }
    if (els.h2) { els.h2.textContent = h[1]; if (els.h2b) els.h2b.textContent = h[1]; }
    if (els.m1) { els.m1.textContent = m[0]; if (els.m1b) els.m1b.textContent = m[0]; }
    if (els.m2) { els.m2.textContent = m[1]; if (els.m2b) els.m2b.textContent = m[1]; }

    if (secondHand) {
        updateSecondHand(secondHand);
        const animate = () => { updateSecondHand(secondHand); requestAnimationFrame(animate); };
        animate();
    }

    setInterval(() => updateClock(timeElement), 1000);
    initWeather();
}

function initWeather() {
    fetchWeather();
    setInterval(fetchWeather, 30 * 60 * 1000); // 30분 간격 (Rate Limit 방지)
}

async function fetchWeather() {
    try {
        console.log('Fetching weather data...');
        const response = await fetch(`/api/weather?t=${Date.now()}`);
        if (!response.ok) throw new Error('API failed');
        const data = await response.json();
        console.log('Weather data received:', data);
        updateWeatherUI(data);
    } catch (e) { console.error('Weather fetch error:', e); }
}

function getValueRecursive(obj, category, time = null) {
    try {
        if (!obj || typeof obj !== 'object' || obj.error || obj.content) return null;
        let body = obj.response?.body;
        if (!body) return null;
        let items = body.items?.item || body.items;
        if (!items) return null;
        if (!Array.isArray(items)) items = [items];

        if (time) {
            const item = items.find(i => i.category === category && i.fcstTime === time);
            return item ? item.fcstValue || item.obsrValue : null;
        }
        const item = items.find(i => i.category === category);
        return item ? item.obsrValue || item.fcstValue : null;
    } catch (e) { return null; }
}

function updateWeatherUI(data) {
    if (!data) return;
    const { ncst, fcst, ultra_fcst, pollution } = data;
    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const hourStr = `${String(now.getHours()).padStart(2, '0')}00`;

    // 🔴 1. 현재 기온 및 습도 (ncst 로드 실패 시 ultra_fcst 백업)
    try {
        const tempValue = getValueRecursive(ncst, 'T1H') || getValueRecursive(ultra_fcst, 'T1H', hourStr);
        if (tempValue !== null) {
            document.getElementById('current-temp').textContent = `${Math.round(parseFloat(tempValue))}°`;
        }
        const humidityValue = getValueRecursive(ncst, 'REH');
        if (humidityValue !== null) {
            document.getElementById('humidity').textContent = `습도 ${Math.round(parseFloat(humidityValue))}%`;
        }
    } catch (e) { }

    // 🔴 2. 최고/최저 기온 (fcst)
    try {
        if (fcst && !fcst.error && fcst.response?.body?.items) {
            let tmn = '--', tmx = '--';
            let items = fcst.response.body.items.item || fcst.response.body.items;
            if (!Array.isArray(items)) items = [items];
            items.forEach(i => {
                if (i.fcstDate === todayStr) {
                    if (i.category === 'TMN') tmn = Math.round(parseFloat(i.fcstValue));
                    if (i.category === 'TMX') tmx = Math.round(parseFloat(i.fcstValue));
                }
            });
            if (tmn !== '--' || tmx !== '--') {
                document.getElementById('min-max-temp').textContent = `${tmn}° / ${tmx}°`;
            }
        }
    } catch (e) { }

    // 🔴 3. 날씨 상태 (Status)
    try {
        const pty = getValueRecursive(ncst, 'PTY') || getValueRecursive(ultra_fcst, 'PTY', hourStr);
        const sky = getValueRecursive(ultra_fcst, 'SKY', hourStr) || '1';
        let statusText = null;
        if (pty && pty !== '0') {
            const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기', '5': '빗방울', '6': '진눈깨비', '7': '눈날림' };
            statusText = ptyMap[pty];
        } else if (sky) {
            const skyMap = { '1': '맑음', '3': '구름많음', '4': '흐림' };
            statusText = skyMap[sky];
        }
        if (statusText) document.getElementById('weather-status').textContent = statusText;
    } catch (e) { }

    // 🔴 4. 미세먼지 (pollution)
    try {
        if (pollution && !pollution.error && pollution.response?.body?.items) {
            let items = pollution.response.body.items;
            if (Array.isArray(items) && items.length > 0) {
                const grade = items[0].pm10Grade;
                const gradeMap = {
                    '1': { text: '좋음', color: '#3498db' },
                    '2': { text: '보통', color: '#27ae60' },
                    '3': { text: '나쁨', color: '#f39c12' },
                    '4': { text: '매우나쁨', color: '#e74c3c' }
                };
                if (gradeMap[grade]) {
                    const el = document.getElementById('fine-dust');
                    el.textContent = `미세먼지 ${gradeMap[grade].text}`;
                    el.style.color = gradeMap[grade].color;
                }
            }
        }
    } catch (e) { }

    // 🔴 5. 버전 표시 (디버깅)
    try {
        let ver = document.getElementById('debug-version') || document.createElement('div');
        ver.id = 'debug-version';
        Object.assign(ver.style, { position: 'fixed', bottom: '10px', right: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', zIndex: '9999' });
        if (!ver.parentNode) document.body.appendChild(ver);
        ver.textContent = `v2.3 | API: ${data.version || 'old'}`;
    } catch (e) { }
}

function updateSecondHand(element) {
    const now = new Date();
    const rot = ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * 360;
    element.style.transform = `translate(-50%, -100%) rotate(${rot}deg)`;
}

let previousTime = { hoursTens: '0', hoursOnes: '0', minutesTens: '0', minutesOnes: '0' };

function updateClock(timeElement) {
    const now = new Date();
    const h12 = (now.getHours() % 12) || 12;
    const h = String(h12).padStart(2, '0'), m = String(now.getMinutes()).padStart(2, '0');
    const curr = { hoursTens: h[0], hoursOnes: h[1], minutesTens: m[0], minutesOnes: m[1] };
    flipDigit('hours-tens', 'hours-tens-new', previousTime.hoursTens, curr.hoursTens);
    flipDigit('hours-ones', 'hours-ones-new', previousTime.hoursOnes, curr.hoursOnes);
    flipDigit('minutes-tens', 'minutes-tens-new', previousTime.minutesTens, curr.minutesTens);
    flipDigit('minutes-ones', 'minutes-ones-new', previousTime.minutesOnes, curr.minutesOnes);
    previousTime = { ...curr };
    const dEl = document.getElementById('date');
    if (dEl) {
        const d = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        dEl.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${d[now.getDay()]}`;
    }
}

function flipDigit(f, b, o, n) {
    if (o === n) return;
    const fe = document.getElementById(f), be = document.getElementById(b);
    const card = fe?.closest('.flip-card');
    if (!fe || !be || !card) return;
    be.textContent = n;
    const d = Math.random() * 0.15;
    setTimeout(() => card.classList.add('flip'), d * 1000);
    setTimeout(() => { fe.textContent = n; card.classList.remove('flip'); }, 1200 + d * 1000);
}
