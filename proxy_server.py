from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
import datetime
import urllib.parse
import json

app = Flask(__name__)
CORS(app)

# 환경 변수 설정 (Render 배포 시 Dashboard에서 설정 필수)
PUBLIC_DATA_SERVICE_KEY = os.environ.get('PUBLIC_DATA_SERVICE_KEY', '')
NX = os.environ.get('NX', '60')
NY = os.environ.get('NY', '127')
STATION_NAME = os.environ.get('STATION_NAME', '종로구')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)


# 캐시 설정
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weather_cache.json')

# 날씨 데이터 캐싱을 위한 전역 변수
weather_cache = None
last_cache_time = None

def load_cache():
    """서버 시작 시 파일에서 캐시 로드"""
    global weather_cache, last_cache_time
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                weather_cache = data.get('weather')
                ts = data.get('timestamp')
                if ts:
                    last_cache_time = datetime.datetime.fromisoformat(ts)
                    print(f"> iPhone: 캐시 파일 로드 완료: {last_cache_time}")
    except Exception as e:
        print(f"> iPhone: 캐시 파일 로드 실패: {e}")

def save_cache():
    """캐시를 파일에 저장"""
    global weather_cache, last_cache_time
    try:
        if weather_cache:
            data = {
                'weather': weather_cache,
                'timestamp': last_cache_time.isoformat() if last_cache_time else datetime.datetime.now().isoformat()
            }
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"> iPhone: 캐시 저장 실패: {e}")

@app.route('/api/weather')
def proxy_weather():
    """기상청 및 에어코리아 API를 프록시합니다."""
    global weather_cache, last_cache_time
    
    # 캐시 유효 시간 (1시간 - API 호출 최소화)
    CACHE_DURATION = datetime.timedelta(minutes=60)
    
    # 캐시된 데이터가 있고 유효하다면 바로 반환
    if weather_cache and last_cache_time and (datetime.datetime.now() - last_cache_time < CACHE_DURATION):
        print(f"> 캐시된 날씨 데이터 반환 (Updated: {last_cache_time.strftime('%H:%M:%S')})")
        return jsonify(weather_cache)

    try:
        # 한국 시간(KST, UTC+9)으로 강제 변환
        now_kst = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
        
        # 인증키 중복 인코딩 방지를 위해 unquote 처리
        service_key = urllib.parse.unquote(PUBLIC_DATA_SERVICE_KEY)
        
        # 1. 기상청 초단기실황 (현재 관측 기온, 습도)
        ncst_time = (now_kst - datetime.timedelta(minutes=40)).strftime('%H00')
        ncst_date = (now_kst - datetime.timedelta(minutes=40)).strftime('%Y%m%d')
        
        ncst_url = (
            f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
            f"?serviceKey={service_key}&dataType=JSON&numOfRows=10&pageNo=1"
            f"&base_date={ncst_date}&base_time={ncst_time}&nx={NX}&ny={NY}"
        )

        # 2. 기상청 초단기예보 (현재 시점부터의 6시간 예보)
        ultra_fcst_dt = now_kst - datetime.timedelta(minutes=45)
        ultra_fcst_date = ultra_fcst_dt.strftime('%Y%m%d')
        ultra_fcst_time = ultra_fcst_dt.strftime('%H00')
        
        ultra_fcst_url = (
            f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst"
            f"?serviceKey={service_key}&dataType=JSON&numOfRows=60&pageNo=1"
            f"&base_date={ultra_fcst_date}&base_time={ultra_fcst_time}&nx={NX}&ny={NY}"
        )

        # 3. 기상청 단기예보 (오늘의 최고/최저 기온 확보용)
        # 오늘 전체의 최고/최저 기온은 0200시 발표 데이터에만 포함되어 있습니다.
        if now_kst.hour < 2:
            # 새벽 2시 이전이면 전날 23시 데이터 사용
            fcst_dt = now_kst - datetime.timedelta(days=1)
            fcst_date, fcst_time = fcst_dt.strftime('%Y%m%d'), "2300"
        else:
            # 그 외에는 오늘 0200시 데이터를 가져와야 오늘 전체의 최저/최고 기온이 나옵니다.
            fcst_date, fcst_time = now_kst.strftime('%Y%m%d'), "0200"
        
        fcst_url = (
            f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
            f"?serviceKey={service_key}&dataType=JSON&numOfRows=1000&pageNo=1"
            f"&base_date={fcst_date}&base_time={fcst_time}&nx={NX}&ny={NY}"
        )

        # 4. 에어코리아 대기오염 정보
        station_encoded = urllib.parse.quote(STATION_NAME)
        pollution_url = (
            f"http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
            f"?serviceKey={service_key}&returnType=json&numOfRows=1&pageNo=1"
            f"&stationName={station_encoded}&dataTerm=DAILY&ver=1.0"
        )

        def fetch_json(url):
            try:
                print(f"DEBUG: Fetching {url[:80]}...")
                # requests.get에 url 직접 전달 시 인코딩 문제가 생길 수 있어 주의 필요
                # KMA는 이미 인코딩된 키를 받으면 가끔 오류가 나므로 unquote된 키를 사용하는 것이 안전함
                r = requests.get(url, timeout=5)
                try:
                    return r.json()
                except:
                    # JSON 파싱 실패 시 원문 에러 메시지 반환 (디버깅용)
                    return {"error": "Invalid JSON", "content": r.text[:200]}
            except Exception as e:
                return {"error": str(e)}

        # 데이터 통합 및 부분 업데이트 로직
        new_data = {}
        api_configs = [
            ('ncst', ncst_url),
            ('ultra_fcst', ultra_fcst_url),
            ('fcst', fcst_url),
            ('pollution', pollution_url)
        ]

        for key, url in api_configs:
            result = fetch_json(url)
            # 에러가 없고 유효한 데이터인 경우에만 성공으로 판단
            if result and not result.get('error'):
                new_data[key] = result
                print(f"> iPhone: {key} 데이터 가져오기 성공")
            elif weather_cache and key in weather_cache:
                new_data[key] = weather_cache[key]
                print(f"> iPhone: {key} 데이터 가져오기 실패 - 기존 캐시 유지")
            else:
                new_data[key] = result or {"error": "No data"}
                print(f"> iPhone: {key} 데이터 없음/실패")

        # 업데이트된 데이터로 캐시 갱신
        weather_cache = new_data
        last_cache_time = datetime.datetime.now()
        save_cache() # 파일에 저장
        print("> iPhone: 날씨 데이터 통합 캐시 업데이트 완료")

        return jsonify(weather_cache)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    load_cache() # 시작 시 캐시 로드
    port = int(os.environ.get('PORT', 9001))
    app.run(host='0.0.0.0', port=port)
