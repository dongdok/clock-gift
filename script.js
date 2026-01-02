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
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Weather API request failed');

        const data = await response.json();

        if (data.error) {
            console.error('Weather error:', data.error);
            return;
        }

        updateWeatherUI(data);
    } catch (error) {
        console.error('Failed to fetch weather:', error);
    }
}

/**
 * 날씨 UI 업데이트 (기상청/에어코리아 버전)
 */
function updateWeatherUI(data) {
    const { ncst, fcst, ultra_fcst, pollution } = data;

    try {
        // 현재 시간 정보 (KST 기준 비교를 위해)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const currentHourStr = `${hour}00`;
        const todayStr = `${year}${month}${day}`;

        // 1. 초단기실황 (현재 관측 기온, 습도)
        let currentTemp = null;
        let pty = '0';

        if (ncst && ncst.response && ncst.response.body && ncst.response.body.items) {
            const ncstItems = ncst.response.body.items.item;
            const ncstObj = {};
            ncstItems.forEach(item => {
                ncstObj[item.category] = item.obsrValue;
            });

            if (ncstObj['T1H']) {
                currentTemp = Math.round(ncstObj['T1H']);
                document.getElementById('current-temp').textContent = `${currentTemp}°`;
            }
            if (ncstObj['REH'] !== undefined && ncstObj['REH'] !== null) {
                const humidity = Math.round(ncstObj['REH']);
                document.getElementById('humidity').textContent = `습도 ${humidity}%`;
            } else {
                document.getElementById('humidity').textContent = `습도 --%`;
            }
            pty = ncstObj['PTY'] || '0';
        } else {
            // ncst 데이터가 없을 경우 기본값 표시
            document.getElementById('humidity').textContent = `습도 --%`;
        }

        // 2. 초단기예보 (UltraSrtFcst) - 실황이 없거나 보완이 필요할 때 사용
        let ultraStatusText = null;
        if (ultra_fcst && ultra_fcst.response && ultra_fcst.response.body && ultra_fcst.response.body.items) {
            const ultraItems = ultra_fcst.response.body.items.item;

            // 현재 시각에 가장 가까운 예보 데이터 찾기
            const currentUltra = ultraItems
                .filter(item => item.fcstDate === todayStr)
                .sort((a, b) => Math.abs(a.fcstTime - currentHourStr) - Math.abs(b.fcstTime - currentHourStr))
                .slice(0, 10);


            if (currentUltra.length > 0) {
                const ultraObj = {};
                currentUltra.forEach(item => {
                    ultraObj[item.category] = item.fcstValue;
                });

                // 실황 기온이 없을 경우 초단기예보 기온 사용
                if (currentTemp === null && ultraObj['T1H']) {
                    currentTemp = Math.round(ultraObj['T1H']);
                    document.getElementById('current-temp').textContent = `${currentTemp}°`;
                }

                // 하늘 상태 (SKY) 및 강수 형태 (PTY) 기반 상태 텍스트
                const ultraPty = ultraObj['PTY'] || '0';
                const ultraSky = ultraObj['SKY'] || '1';

                if (ultraPty === '0') {
                    if (ultraSky === '1') ultraStatusText = '맑음';
                    else if (ultraSky === '3') ultraStatusText = '구름많음';
                    else ultraStatusText = '흐림';
                } else {
                    const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기', '5': '빗방울', '6': '진눈깨비', '7': '눈날림' };
                    ultraStatusText = ptyMap[ultraPty] || '강수';
                }
            }
        }

        // 3. 단기예보 (VilageFcst) - 최고/최저 기온 및 날씨 흐름
        if (fcst && fcst.response && fcst.response.body && fcst.response.body.items) {
            const fcstItems = fcst.response.body.items.item;

            let tmn = '--'; // 최저
            let tmx = '--'; // 최고

            fcstItems.forEach(item => {
                // 오늘 날짜의 TMN/TMX만 사용
                if (item.fcstDate === todayStr) {
                    if (item.category === 'TMN') tmn = Math.round(item.fcstValue);
                    if (item.category === 'TMX') tmx = Math.round(item.fcstValue);
                }
            });

            const minMaxEl = document.getElementById('min-max-temp');
            if (minMaxEl) {
                minMaxEl.textContent = `${tmn}° / ${tmx}°`;
                minMaxEl.style.display = 'inline';
            }
            const divider = document.querySelector('.divider');
            if (divider) divider.style.display = 'inline';

            // 날씨 상태 업데이트 (초단기예보 우선, 없으면 단기예보 활용)
            let finalStatus = ultraStatusText;
            if (!finalStatus) {
                const skyItem = fcstItems.find(item => item.fcstDate === todayStr && item.fcstTime === currentHourStr && item.category === 'SKY');
                if (skyItem) {
                    const skyVal = skyItem.fcstValue;
                    if (pty === '0') {
                        if (skyVal === '1') finalStatus = '맑음';
                        else if (skyVal === '3') finalStatus = '구름많음';
                        else finalStatus = '흐림';
                    } else {
                        const ptyMap = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기', '5': '빗방울', '6': '진눈깨비', '7': '눈날림' };
                        finalStatus = ptyMap[pty] || '강수';
                    }
                }
            }

            const statusEl = document.getElementById('weather-status');
            if (statusEl) {
                statusEl.textContent = finalStatus || '--';
            }
        }

        // 3. 에어코리아 데이터 파싱 및 색상 적용
        let dustStatus = '정보없음';
        let dustColor = '#2d5016'; // 기본 포레스트 그린

        const dustEl = document.getElementById('fine-dust');

        if (pollution && pollution.response && pollution.response.body && pollution.response.body.items && pollution.response.body.items.length > 0) {
            const pollutionItem = pollution.response.body.items[0];
            const pm10Grade = pollutionItem.pm10Grade;

            const gradeMap = {
                '1': { status: '좋음', color: '#3498db' },
                '2': { status: '보통', color: '#27ae60' },
                '3': { status: '나쁨', color: '#f39c12' },
                '4': { status: '매우나쁨', color: '#e74c3c' }
            };

            if (!pm10Grade || pm10Grade === '-') {
                if (dustEl) dustEl.textContent = '미세먼지 정보없음';
            } else if (gradeMap[pm10Grade]) {
                dustStatus = gradeMap[pm10Grade].status;
                dustColor = gradeMap[pm10Grade].color;
            }
        }

        if (dustEl) {
            dustEl.textContent = `미세먼지 ${dustStatus}`;
            dustEl.style.color = dustColor;
            dustEl.style.fontWeight = '500';
            dustEl.style.transition = 'color 0.5s ease';
        }

        // 아이콘은 더 이상 사용하지 않으므로 숨김 유지
        const iconEl = document.getElementById('weather-icon');
        if (iconEl) iconEl.style.display = 'none';

    } catch (e) {
        console.error('Error parsing weather data:', e);
    }
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

