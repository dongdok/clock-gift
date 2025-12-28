// 전체화면 모드 및 상태바 숨기기 시도
// 홈 화면 앱과 Safari 모두 지원

// 홈 화면 앱 모드 확인
const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

// 전체화면 모드 진입 시도
function requestFullscreen() {
    // 홈 화면 앱에서는 전체화면 API가 제한될 수 있음
    if (isStandalone) {
        console.log('홈 화면 앱 모드에서는 전체화면 API가 제한될 수 있습니다.');
        return;
    }
    
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.webkitEnterFullscreen) {
        element.webkitEnterFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}

// 전체화면 모드 종료
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

// 더블 탭으로 전체화면 토글 (홈 화면 앱에서도 작동)
let lastTap = 0;
let tapTimeout;

document.addEventListener('touchend', function(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    clearTimeout(tapTimeout);
    
    if (tapLength < 300 && tapLength > 0) {
        // 더블 탭 감지
        if (isStandalone) {
            // 홈 화면 앱에서는 전체화면 토글 대신 다른 기능 수행 가능
            console.log('홈 화면 앱 모드: 더블 탭 감지');
        } else {
            // Safari에서는 전체화면 토글
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                exitFullscreen();
            } else {
                requestFullscreen();
            }
        }
        event.preventDefault();
    } else {
        // 싱글 탭인 경우 타임아웃 설정
        tapTimeout = setTimeout(() => {
            // 싱글 탭 처리 (필요시)
        }, 300);
    }
    lastTap = currentTime;
}, { passive: false });

// 핀치 제스처 감지 (확대/축소 방지)
let initialDistance = 0;
document.addEventListener('touchstart', function(event) {
    if (event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }
}, { passive: true });

document.addEventListener('touchmove', function(event) {
    if (event.touches.length === 2) {
        event.preventDefault(); // 핀치 제스처 방지
    }
}, { passive: false });

// 홈 화면 앱 모드에서 상태바 영역 최소화
if (isStandalone) {
    document.body.style.paddingTop = '0';
    document.body.style.marginTop = '0';
    console.log('홈 화면 앱 모드 감지됨');
}

