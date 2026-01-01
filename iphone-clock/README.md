# iPhone Forest Green Clock - 프로젝트 요약

## 1. 주요 기능 및 디자인
- **디자인 컨셉**: Forest Green 테마의 미니멀 프리미엄 디자인
- **핵심 UI**: 75vh 초대형 시계 숫자, 11vh 기온 표시, 30vh 광활한 정보 여백
- **특수 효과**: 화면 전체를 부드럽게 가로지르는 시네마틱 초침 효과

## 2. 사용된 API (Weather & Air Quality)
- **데이터 출처**: 공공데이터포털(data.go.kr)
- **날씨 데이터**: 기상청 단기예보 및 초단기실황 서비스
- **대기오염 데이터**: 한국환경공단(에어코리아) 대기오염정보 서비스
- **필요 인증키**: 공공데이터포털에서 발급받은 '일반 인증서(Encoding)' 키 (하나의 키로 위 서비스 모두 이용 가능)

## 3. 핵심 설정 정보 (Environment Variables)
Render.com 등의 서버에서 환경 변수로 설정해야 할 항목입니다:
- `PUBLIC_DATA_SERVICE_KEY`: 공공데이터포털 인증키
- `STATION_NAME`: 미세먼지 측정 지점명 (예: 종로구)
- `NX`: 기상청 좌표 (X값, 서울 기준 60)
- `NY`: 기상청 좌표 (Y값, 서울 기준 127)

## 4. 배포 환경 및 사이트
- **코드 저장소**: GitHub (나만의 레시피 저장소)
- **서버 호스팅**: Render.com
- **최종 URL**: https://clock-gift.onrender.com

## 5. 기술 스택
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS)
- **Backend**: Python 3 (Flask)
- **Dependencies**: `flask`, `flask-cors`, `requests`, `python-dotenv`
