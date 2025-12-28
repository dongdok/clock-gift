#!/usr/bin/env python3
"""
Home Assistant API 프록시 서버 (iPhone Clock)
CORS 문제를 해결하며 포트 9001에서 실행됩니다.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.request
import urllib.error
import os

# config.js에서 설정한 값들 (iPad-clock 설정을 따름)
# Home Assistant 설정
HA_URL = os.environ.get('HA_URL', 'http://192.168.10.104:8123')
HA_TOKEN = os.environ.get('HA_TOKEN', '')

# 공공데이터포털 설정 (data.go.kr)
# Render 등 서버 설정에서 PUBLIC_DATA_SERVICE_KEY 이름으로 등록하세요.
PUBLIC_DATA_SERVICE_KEY = os.environ.get('PUBLIC_DATA_SERVICE_KEY', 'f4a86db25a9ffd47dc132bd1b1b34d1234737d27189e261e821ca117d2d6e741')

# 위치 설정 (서울 기준 nx=60, ny=127)
NX = os.environ.get('NX', '60')
NY = os.environ.get('NY', '127')
# 에어코리아 측정을 위한 스테이션 이름 (종로구 기준)
STATION_NAME = os.environ.get('STATION_NAME', '종로구')

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 정적 파일 서빙
        if self.path == '/' or self.path.startswith('/index.html'):
            self.path = '/index.html'
            return self.serve_static()
        
        if self.path.endswith('.html') or self.path.endswith('.css') or self.path.endswith('.js') or self.path.endswith('.md') or self.path.endswith('.json'):
            return self.serve_static()
        
        # API 프록시
        if self.path.startswith('/api/weather'):
            return self.proxy_weather()
        
        if self.path.startswith('/api/'):
            return self.proxy_api()
        
        # 기본적으로 정적 파일 서빙
        return self.serve_static()
    
    def serve_static(self):
        try:
            if self.path == '/':
                self.path = '/index.html'
            
            file_path = self.path.lstrip('/')
            if not file_path:
                file_path = 'index.html'
            
            # 보안: 상위 디렉토리 접근 방지
            if '..' in file_path:
                self.send_error(403, "Forbidden")
                return
            
            # 스크립트 파일이 있는 디렉토리를 기준으로 파일 경로 설정
            base_dir = os.path.dirname(os.path.abspath(__file__))
            abs_file_path = os.path.join(base_dir, file_path)
            
            with open(abs_file_path, 'rb') as f:
                content = f.read()
            
            # Content-Type 설정
            content_type = 'text/html'
            if file_path.endswith('.css'):
                content_type = 'text/css'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript'
            elif file_path.endswith('.json'):
                content_type = 'application/json'
            elif file_path.endswith('.md'):
                content_type = 'text/markdown'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, "File not found")
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")
    
    
    def proxy_weather(self):
        """기상청 및 에어코리아 API를 프록시합니다."""
        try:
            import datetime
            import urllib.parse
            if not PUBLIC_DATA_SERVICE_KEY:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'PUBLIC_DATA_SERVICE_KEY is missing'}).encode())
                return

            now = datetime.datetime.now()
            
            # 1. 기상청 초단기실황 (기온, 습도 등 실시간)
            # 40분 주기로 업데이트되므로 안전하게 40분 전 데이터 요청
            ncst_time = (now - datetime.timedelta(minutes=40)).strftime('%H00')
            ncst_date = (now - datetime.timedelta(minutes=40)).strftime('%Y%m%d')
            
            ncst_url = (
                f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
                f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&dataType=JSON&numOfRows=10&pageNo=1"
                f"&base_date={ncst_date}&base_time={ncst_time}&nx={NX}&ny={NY}"
            )

            # 2. 기상청 단기예보 (오늘의 최고/최저 기온)
            # 단기예보는 02시, 05시, 08시... 등 3시간 주기로 생성됨. 02시가 당일 최저/최고를 포함함.
            # 안전하게 오늘 오전 02시 00분 기준으로 요청
            fcst_date = now.strftime('%Y%m%d')
            fcst_time = "0200"
            
            fcst_url = (
                f"http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
                f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&dataType=JSON&numOfRows=1000&pageNo=1"
                f"&base_date={fcst_date}&base_time={fcst_time}&nx={NX}&ny={NY}"
            )

            # 3. 에어코리아 대기오염 정보
            station_encoded = urllib.parse.quote(STATION_NAME)
            pollution_url = (
                f"http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
                f"?serviceKey={PUBLIC_DATA_SERVICE_KEY}&returnType=json&numOfRows=1&pageNo=1"
                f"&stationName={station_encoded}&dataTerm=DAILY&ver=1.0"
            )

            # 데이터 페칭
            def fetch_json(url):
                try:
                    with urllib.request.urlopen(url) as res:
                        return json.loads(res.read())
                except:
                    return {"error": "Failed to fetch"}

            response_data = {
                'ncst': fetch_json(ncst_url),
                'fcst': fetch_json(fcst_url),
                'pollution': fetch_json(pollution_url)
            }
            
            data = json.dumps(response_data).encode()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
            
        except Exception as e:
            print(f"Weather API Error: {str(e)}")
            error_response = json.dumps({'error': str(e)}).encode()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_response)

    def proxy_api(self):
        """Home Assistant API를 프록시합니다."""
        try:
            api_path = self.path
            ha_api_url = f"{HA_URL}{api_path}"
            
            req = urllib.request.Request(ha_api_url)
            req.add_header('Authorization', f'Bearer {HA_TOKEN}')
            req.add_header('Content-Type', 'application/json')
            
            with urllib.request.urlopen(req) as response:
                data = response.read()
                status_code = response.getcode()
                
                self.send_response(status_code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        
        except urllib.error.HTTPError as e:
            error_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_body)
        
        except Exception as e:
            error_response = json.dumps({'error': str(e)}).encode()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def do_OPTIONS(self):
        """CORS preflight 요청 처리"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """로그 메시지 포맷팅"""
        print(f"[{self.address_string()}] {format % args}")

def run(port=9001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, ProxyHandler)
    print(f'iPhone 시계 프록시 서버가 http://localhost:{port} 에서 실행 중입니다.')
    print(f'Home Assistant: {HA_URL}')
    print('종료하려면 Ctrl+C를 누르세요.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n서버를 종료합니다.')
        httpd.server_close()

if __name__ == '__main__':
    run(9001)
