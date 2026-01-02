// VERSION: 2.2 - Deployment Sync
// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('--- iPhone Clock Script v2.2 Loaded ---');
    initClock();
});

/**
 * 시계 초기화 및 업데이트
 */
function initClock() {
    const timeElement = document.getElementById('time');
    const secondHand = document.querySelector('.second-hand');

    const now = new Date();
    const hours24 = now.getHours();
    const hours12 = (hours24 % 12) || 12;
    const hours = String(hours12).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    previousTime = {
        hoursTens: hours[0],
        hoursOnes: hours[1],
        minutesTens: minutes[0],
        minutesOnes: minutes[1]
    };

    const elements = {
        h1: document.getElementById('hours-tens'),
        h2: document.getElementById('hours-ones'),
        m1: document.getElementById('minutes-tens'),
        m2: document.getElementById('minutes-ones'),
        h1b: document.getElementById('hours-tens-new'),
        h2b: document.getElementById('hours-ones-new'),
        m1b: document.getElementById('minutes-tens-new'),
        m2b: document.getElementById('minutes-ones-new')
    };

    if (elements.h1) { elements.h1.textContent = hours[0]; if (elements.h1b) elements.h1b.textContent = hours[0]; }
    if (elements.h2) { elements.h2.textContent = hours[1]; if (elements.h2b) elements.h2b.textContent = hours[1]; }
    if (elements.m1) { elements.m1.textContent = minutes[0]; if (elements.m1b) elements.m1b.textContent = minutes[0]; }
    if (elements.m2) { elements.m2.textContent = minutes[1]; if (elements.m2b) elements.m2b.textContent = minutes[1]; }

    if (secondHand) {
        updateSecondHand(secondHand);
        function animateSecondHand() {
            updateSecondHand(secondHand);
            requestAnimationFrame(animateSecondHand);
        }
        animateSecondHand();
    }

    setInterval(() => updateClock(timeElement), 1000);
    initWeather();
}

function initWeather() {
    fetchWeather();
    setInterval(fetchWeather, 60 * 60 * 1000);
}

async function fetchWeather() {
    try {
        console.log('Fetching weather data...');
        const response = await fetch(`/api/weather?t=${Date.now()}`);
        if (!response.ok) throw new Error('Weather API request failed');

        const data = await response.json();
        console.log('Weather data received:', data);
        updateWeatherUI(data);
    } catch (error) {
        console.error('Failed to fetch weather:', error);
    }
}

function getValueRecursive(obj, category, time = null) {
    try {
        if (!obj || typeof obj !== 'object') return null;
        let items = null;
        if (obj.response && obj.response.body && obj.response.body.items) {
            items = obj.response.body.items.item || obj.response.body.items;
        } else if (obj.items) {
            items = obj.items.item || obj.items;
        }
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

    // 1. 현재 기온 및 습도
    try {
        const temp = getValueRecursive(ncst, 'T1H') || getValueRecursive(ultra_fcst, 'T1H', hourStr);
        if (temp !== null) document.getElementById('current-temp').textContent = `${Math.round(parseFloat(temp))}°`;
        const humidity = getValueRecursive(ncst, 'REH');
        if (humidity !== null) document.getElementById('humidity').textContent = `습도 ${Math.round(parseFloat(humidity))}%`;
    } catch (e) { }

    // 2. 최고/최저 기온
    try {
        let tmn = '--';
        let tmx = '--';
        if (fcst && fcst.response && fcst.response.body && fcst.response.body.items) {
            let items = fcst.response.body.items.item || fcst.response.body.items;
            if (!Array.isArray(items)) items = [items];
            items.forEach(i => {
                if (i.fcstDate === todayStr) {
                    if (i.category === 'TMN') tmn = Math.round(parseFloat(i.fcstValue));
                    if (i.category === 'TMX') tmx = Math.round(parseFloat(i.fcstValue));
                }
            });
        }
        document.getElementById('min-max-temp').textContent = `${tmn}° / ${tmx}°`;
    } catch (e) { }

    // 3. 날씨 상태
    try {
        const pty = getValueRecursive(ncst, 'PTY') || getValueRecursive(ultra_fcst, 'PTY', hourStr);
        const sky = getValueRecursive(ultra_fcst, 'SKY', hourStr) || '1';
        let status = '맑음';
        if (pty && pty !== '0') {
            const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기', '5': '빗방울', '6': '진눈깨비', '7': '눈날림' };
            status = ptyMap[pty] || '강수';
        } else if (sky) {
            const skyMap = { '1': '맑음', '3': '구름많음', '4': '흐림' };
            status = skyMap[sky] || '맑음';
        }
        document.getElementById('weather-status').textContent = status;
    } catch (e) { }

    // 4. 미세먼지
    try {
        const dustEl = document.getElementById('fine-dust');
        if (dustEl && pollution && pollution.response && pollution.response.body && pollution.response.body.items) {
            let items = pollution.response.body.items.item || pollution.response.body.items;
            if (!Array.isArray(items)) items = [items];
            if (items.length > 0) {
                const grade = items[0].pm10Grade;
                const gradeMap = {
                    '1': { text: '좋음', color: '#3498db' },
                    '2': { text: '보통', color: '#27ae60' },
                    '3': { text: '나쁨', color: '#f39c12' },
                    '4': { text: '매우나쁨', color: '#e74c3c' }
                };
                if (gradeMap[grade]) {
                    dustEl.textContent = `미세먼지 ${gradeMap[grade].text}`;
                    dustEl.style.color = gradeMap[grade].color;
                }
            }
        }
    } catch (e) { }

    // 5. 서버 버전 확인 (Debug)
    try {
        let verEl = document.getElementById('debug-version');
        if (!verEl) {
            verEl = document.createElement('div');
            verEl.id = 'debug-version';
            verEl.style.position = 'fixed';
            verEl.style.bottom = '10px';
            verEl.style.right = '10px';
            verEl.style.fontSize = '10px';
            verEl.style.color = 'rgba(255,255,255,0.3)';
            verEl.style.zIndex = '9999';
            document.body.appendChild(verEl);
        }
        verEl.textContent = `JS: v2.2 | API: ${data.version || 'old'}`;
    } catch (e) { }
}

function updateSecondHand(element) {
    const now = new Date();
    const rotation = ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * 360;
    element.style.transform = `translate(-50%, -100%) rotate(${rotation}deg)`;
}

let previousTime = { hoursTens: '0', hoursOnes: '0', minutesTens: '0', minutesOnes: '0' };

function updateClock(timeElement) {
    const now = new Date();
    const h12 = (now.getHours() % 12) || 12;
    const h = String(h12).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const curr = { hoursTens: h[0], hoursOnes: h[1], minutesTens: m[0], minutesOnes: m[1] };

    flipDigit('hours-tens', 'hours-tens-new', previousTime.hoursTens, curr.hoursTens);
    flipDigit('hours-ones', 'hours-ones-new', previousTime.hoursOnes, curr.hoursOnes);
    flipDigit('minutes-tens', 'minutes-tens-new', previousTime.minutesTens, curr.minutesTens);
    flipDigit('minutes-ones', 'minutes-ones-new', previousTime.minutesOnes, curr.minutesOnes);

    previousTime = { ...curr };
    const dateEl = document.getElementById('date');
    if (dateEl) {
        const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        dateEl.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekdays[now.getDay()]}`;
    }
}

function flipDigit(f, b, oldV, newV) {
    if (oldV === newV) return;
    const fe = document.getElementById(f);
    const be = document.getElementById(b);
    const card = fe ? fe.closest('.flip-card') : null;
    if (!fe || !be || !card) return;
    be.textContent = newV;
    const delay = Math.random() * 0.15;
    setTimeout(() => card.classList.add('flip'), delay * 1000);
    setTimeout(() => { fe.textContent = newV; card.classList.remove('flip'); }, 1200 + delay * 1000);
}
