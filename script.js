// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 시계 초기화 및 시작
    initClock();
});

/**
 * 시계 초기화 및 업데이트
 */
function initClock() {
    const timeElement = document.getElementById('time');
    const secondHand = document.querySelector('.second-hand');

    // 초기 시간 값 설정 (플립 애니메이션 없이) - 12시간제
    const now = new Date();
    const hours24 = now.getHours();
    const hours12 = (hours24 % 12) || 12; // 0시는 12로, 13~23시는 1~11로 변환
    const hours = String(hours12).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    previousTime = {
        hoursTens: hours[0],
        hoursOnes: hours[1],
        minutesTens: minutes[0],
        minutesOnes: minutes[1]
    };

    // 초기 값 표시 (플립 애니메이션 없이 즉시 표시)
    const hoursTensEl = document.getElementById('hours-tens');
    const hoursOnesEl = document.getElementById('hours-ones');
    const minutesTensEl = document.getElementById('minutes-tens');
    const minutesOnesEl = document.getElementById('minutes-ones');

    // 초기 값 표시 (플립 카드의 front와 back 모두 설정)
    if (hoursTensEl) {
        hoursTensEl.textContent = hours[0];
        const hoursTensBack = document.getElementById('hours-tens-new');
        if (hoursTensBack) hoursTensBack.textContent = hours[0];
    }
    if (hoursOnesEl) {
        hoursOnesEl.textContent = hours[1];
        const hoursOnesBack = document.getElementById('hours-ones-new');
        if (hoursOnesBack) hoursOnesBack.textContent = hours[1];
    }
    if (minutesTensEl) {
        minutesTensEl.textContent = minutes[0];
        const minutesTensBack = document.getElementById('minutes-tens-new');
        if (minutesTensBack) minutesTensBack.textContent = minutes[0];
    }
    if (minutesOnesEl) {
        minutesOnesEl.textContent = minutes[1];
        const minutesOnesBack = document.getElementById('minutes-ones-new');
        if (minutesOnesBack) minutesOnesBack.textContent = minutes[1];
    }

    // 초침 초기 각도 설정 및 부드러운 애니메이션 시작
    if (secondHand) {
        // 초침을 정확한 초와 동기화
        updateSecondHand(secondHand);

        // requestAnimationFrame을 사용한 부드러운 애니메이션
        let lastSecond = -1;
        function animateSecondHand() {
            const now = new Date();
            const currentSecond = now.getSeconds();

            // 초가 바뀔 때 정확히 동기화
            if (currentSecond !== lastSecond) {
                updateSecondHand(secondHand);
                lastSecond = currentSecond;
            } else {
                // 같은 초 내에서는 부드럽게 업데이트
                updateSecondHand(secondHand);
            }

            requestAnimationFrame(animateSecondHand);
        }
        animateSecondHand();
    }

    // 주기적 업데이트 - 1초마다 체크하되 분이 바뀔 때만 플립 애니메이션
    setInterval(() => {
        updateClock(timeElement);
    }, 1000); // 1초마다 체크하여 정확한 시간 동기화

    // 날씨 초기화 및 시작
    initWeather();
}

/**
 * 날씨 데이터 초기화 및 주기적 업데이트
 */
function initWeather() {
    // 최초 실행
    fetchWeather();

    // 1시간마다 날씨 업데이트 (API 호출 최소화)
    setInterval(fetchWeather, 60 * 60 * 1000);
}

/**
 * 프록시 서버로부터 날씨 데이터를 가져와 UI 업데이트
 */
async function fetchWeather() {
    try {
        console.log('Fetching weather data...');
        const response = await fetch(`/api/weather?t=${Date.now()}`);
        if (!response.ok) throw new Error('Weather API request failed');

        const data = await response.json();
        console.log('Weather data received:', data);

        if (data.error && !data.ncst) {
            console.error('Weather error:', data.error);
            return;
        }

        updateWeatherUI(data);
    } catch (error) {
        console.error('Failed to fetch weather:', error);
    }
}

/**
 * 데이터에서 특정 카테고리 값을 찾는 헬퍼 함수
 */
function getValueRecursive(obj, category, time = null) {
    try {
        if (!obj || typeof obj !== 'object') return null;

        // KMA 스타일: response -> body -> items -> item (배열)
        let items = null;
        if (obj.response && obj.response.body && obj.response.body.items) {
            items = obj.response.body.items.item || obj.response.body.items;
        } else if (obj.items) {
            items = obj.items.item || obj.items;
        }

        if (!items) return null;
        if (!Array.isArray(items)) items = [items];

        if (time) {
            // 특정 시간대 필터링 (fcstTime)
            const item = items.find(i => i.category === category && i.fcstTime === time);
            return item ? item.fcstValue || item.obsrValue : null;
        } else {
            // 가장 첫 번째 발견되는 카테고리 (ncst 등)
            const item = items.find(i => i.category === category);
            return item ? item.obsrValue || item.fcstValue : null;
        }
    } catch (e) {
        return null;
    }
}

/**
 * 날씨 UI 업데이트
 */
function updateWeatherUI(data) {
    if (!data) return;
    const { ncst, fcst, ultra_fcst, pollution } = data;

    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const hourStr = `${String(now.getHours()).padStart(2, '0')}00`;

    console.log(`Updating UI for ${todayStr} ${hourStr}`);

    // 1. 현재 기온 및 습도 (ncst 우선)
    try {
        const temp = getValueRecursive(ncst, 'T1H') || getValueRecursive(ultra_fcst, 'T1H', hourStr);
        if (temp !== null) {
            document.getElementById('current-temp').textContent = `${Math.round(parseFloat(temp))}°`;
        }

        const humidity = getValueRecursive(ncst, 'REH');
        if (humidity !== null) {
            document.getElementById('humidity').textContent = `습도 ${Math.round(parseFloat(humidity))}%`;
        }
    } catch (e) { console.error('NCST update failed', e); }

    // 2. 최고/최저 기온 (fcst)
    try {
        let tmn = '--';
        let tmx = '--';
        if (fcst && fcst.response && fcst.response.body && fcst.response.body.items && fcst.response.body.items.item) {
            const items = Array.isArray(fcst.response.body.items.item) ? fcst.response.body.items.item : [fcst.response.body.items.item];
            items.forEach(i => {
                if (i.fcstDate === todayStr) {
                    if (i.category === 'TMN') tmn = Math.round(parseFloat(i.fcstValue));
                    if (i.category === 'TMX') tmx = Math.round(parseFloat(i.fcstValue));
                }
            });
        }
        document.getElementById('min-max-temp').textContent = `${tmn}° / ${tmx}°`;
    } catch (e) { console.error('FCST update failed', e); }

    // 3. 날씨 상태 (Status)
    try {
        let status = null;
        // PTY (강수형태) 확인
        const pty = getValueRecursive(ncst, 'PTY') || getValueRecursive(ultra_fcst, 'PTY', hourStr);
        const sky = getValueRecursive(ultra_fcst, 'SKY', hourStr) || '1';

        if (pty && pty !== '0') {
            const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기', '5': '빗방울', '6': '진눈깨비', '7': '눈날림' };
            status = ptyMap[pty];
        } else if (sky) {
            const skyMap = { '1': '맑음', '3': '구름많음', '4': '흐림' };
            status = skyMap[sky];
        }
        document.getElementById('weather-status').textContent = status || '맑음';
    } catch (e) { console.error('Status update failed', e); }

    // 4. 미세먼지 (pollution)
    try {
        const dustEl = document.getElementById('fine-dust');
        if (pollution && pollution.response && pollution.response.body && pollution.response.body.items) {
            const items = Array.isArray(pollution.response.body.items) ? pollution.response.body.items : [pollution.response.body.items];
            if (items.length > 0) {
                const item = items[0];
                const grade = item.pm10Grade;
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
    } catch (e) { console.error('Pollution update failed', e); }
}

/**
 * 초침 각도 업데이트
 */
function updateSecondHand(element) {
    const now = new Date();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();
    // 현재 초 + 밀리초를 고려한 정확한 각도
    const rotation = ((seconds + milliseconds / 1000) / 60) * 360;
    element.style.transform = `translate(-50%, -100%) rotate(${rotation}deg)`;
}

// 이전 시간 값 저장
let previousTime = {
    hoursTens: '0',
    hoursOnes: '0',
    minutesTens: '0',
    minutesOnes: '0'
};

/**
 * 시계 업데이트 함수 - 플립 애니메이션 포함
 */
function updateClock(timeElement) {
    const now = new Date();
    const hours24 = now.getHours();
    const hours12 = (hours24 % 12) || 12; // 0시는 12로, 13~23시는 1~11로 변환
    const hours = String(hours12).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const currentTime = {
        hoursTens: hours[0],
        hoursOnes: hours[1],
        minutesTens: minutes[0],
        minutesOnes: minutes[1]
    };

    // 각 숫자별로 플립 애니메이션 적용
    flipDigit('hours-tens', 'hours-tens-new', previousTime.hoursTens, currentTime.hoursTens);
    flipDigit('hours-ones', 'hours-ones-new', previousTime.hoursOnes, currentTime.hoursOnes);
    flipDigit('minutes-tens', 'minutes-tens-new', previousTime.minutesTens, currentTime.minutesTens);
    flipDigit('minutes-ones', 'minutes-ones-new', previousTime.minutesOnes, currentTime.minutesOnes);

    // 이전 값 업데이트
    previousTime = { ...currentTime };

    // 날짜 업데이트
    const dateElement = document.getElementById('date');
    if (dateElement) {
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const weekday = weekdays[now.getDay()];
        const dateString = `${year}년 ${month}월 ${day}일 ${weekday}`;

        if (dateElement.textContent !== dateString) {
            dateElement.textContent = dateString;
        }
    }
}

/**
 * 개별 숫자 플립 애니메이션 - 달력 넘기는 느낌
 */
function flipDigit(frontId, backId, oldValue, newValue) {
    if (oldValue === newValue) return; // 값이 같으면 애니메이션 없음

    const frontElement = document.getElementById(frontId);
    const backElement = document.getElementById(backId);
    const flipCard = frontElement.closest('.flip-card');

    if (!frontElement || !backElement || !flipCard) return;

    // 새 값 설정
    backElement.textContent = newValue;

    // 플립 애니메이션 시작 - 달력 넘기는 느낌을 위해 더 여유 있는 지연
    const randomDelay = Math.random() * 0.15; // 0~0.15초 랜덤 지연 (더 여유 있게)
    setTimeout(() => {
        flipCard.classList.add('flip');
    }, randomDelay * 1000);

    // 애니메이션 완료 후 값 업데이트 및 리셋 - 더 긴 시간으로 여유 있게
    setTimeout(() => {
        frontElement.textContent = newValue;
        flipCard.classList.remove('flip');
    }, 1200 + randomDelay * 1000); // 애니메이션 시간과 동일 (1.2초)
}

