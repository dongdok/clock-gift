from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
import datetime
import urllib.parse

app = Flask(__name__)
CORS(app)

# 환경 변수 설정
PUBLIC_DATA_SERVICE_KEY = os.environ.get('PUBLIC_DATA_SERVICE_KEY', 'f4a86db25a9ffd47dc132bd1b1b34d1234737d27189e261e821ca117d2d6e741')
NX = os.environ.get('NX', '60')
NY = os.environ.get('NY', '127')
STATION_NAME = os.environ.get('STATION_NAME', '종로구')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/weather')
def proxy_weather():
    """기상청 및 에어코리아 API를 프록시합니다."""
    try:
        # 한국 시간(KST, UTC+9)으로 강제 변환
        now_kst = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
        
        # 1. 기상청 초단기실황 (현재 관측 기온, 습도)
        ncst_time = (now_kst - datetime.timedelta(minutes=40)).strftime('%H00')
        ncst_date = (now_kst - datetime.timedelta(minutes=40)).strftime('%Y%m%d')
        
        ncst_url = (
            f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
            f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&dataType=JSON&numOfRows=10&pageNo=1"
            f"&base_date={ncst_date}&base_time={ncst_time}&nx={NX}&ny={NY}"
        )

        # 2. 기상청 초단기예보 (현재 시점부터의 6시간 예보)
        ultra_fcst_dt = now_kst - datetime.timedelta(minutes=45)
        ultra_fcst_date = ultra_fcst_dt.strftime('%Y%m%d')
        ultra_fcst_time = ultra_fcst_dt.strftime('%H00')
        
        ultra_fcst_url = (
            f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst"
            f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&dataType=JSON&numOfRows=60&pageNo=1"
            f"&base_date={ultra_fcst_date}&base_time={ultra_fcst_time}&nx={NX}&ny={NY}"
        )

        # 3. 기상청 단기예보 (오늘의 최고/최저 기온)
        fcst_base_hours = [2, 5, 8, 11, 14, 17, 20, 23]
        current_hour = now_kst.hour
        if current_hour < 2:
            fcst_dt = now_kst - datetime.timedelta(days=1)
            fcst_date = fcst_dt.strftime('%Y%m%d')
            fcst_time = "2300"
        else:
            base_h = max([h for h in fcst_base_hours if h <= current_hour])
            fcst_date = now_kst.strftime('%Y%m%d')
            fcst_time = f"{base_h:02d}00"
        
        fcst_url = (
            f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
            f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&dataType=JSON&numOfRows=1000&pageNo=1"
            f"&base_date={fcst_date}&base_time={fcst_time}&nx={NX}&ny={NY}"
        )

        # 4. 에어코리아 대기오염 정보
        station_encoded = urllib.parse.quote(STATION_NAME)
        pollution_url = (
            f"http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
            f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&returnType=json&numOfRows=1&pageNo=1"
            f"&stationName={station_encoded}&dataTerm=DAILY&ver=1.0"
        )

        def fetch_json(url):
            try:
                print(f"DEBUG: Fetching {url[:60]}...")
                r = requests.get(url, timeout=5)
                return r.json()
            except Exception as e:
                return {"error": str(e)}

        return jsonify({
            'ncst': fetch_json(ncst_url),
            'ultra_fcst': fetch_json(ultra_fcst_url),
            'fcst': fetch_json(fcst_url),
            'pollution': fetch_json(pollution_url)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 9001))
    app.run(host='0.0.0.0', port=port)
