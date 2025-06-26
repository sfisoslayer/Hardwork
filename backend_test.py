import requests
import sys
import time
import json
from datetime import datetime

class CryptoFaucetTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status=200, data=None, check_content=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            status_success = response.status_code == expected_status
            
            content_success = True
            content_message = ""
            if check_content and status_success:
                try:
                    response_data = response.json()
                    content_success, content_message = check_content(response_data)
                except Exception as e:
                    content_success = False
                    content_message = f"Error checking content: {str(e)}"
            
            success = status_success and content_success
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if content_message:
                    print(f"   {content_message}")
            else:
                if not status_success:
                    print(f"❌ Failed - Expected status {expected_status}, got {response.status_code}")
                if not content_success:
                    print(f"❌ Failed - Content check: {content_message}")

            # Store result
            self.test_results.append({
                "name": name,
                "success": success,
                "status_code": response.status_code,
                "expected_status": expected_status,
                "content_message": content_message
            })

            if status_success:
                try:
                    return success, response.json()
                except:
                    return success, {}
            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "success": False,
                "error": str(e)
            })
            return False, {}

    def test_health_endpoint(self):
        """Test the health endpoint"""
        def check_health(data):
            if "status" not in data:
                return False, "Missing 'status' field"
            if data["status"] != "healthy":
                return False, f"Expected status 'healthy', got '{data['status']}'"
            return True, "Health check successful"
            
        return self.run_test(
            "Health Check Endpoint",
            "GET",
            "api/health",
            200,
            check_content=check_health
        )

    def test_stats_endpoint(self):
        """Test the stats endpoint"""
        def check_stats(data):
            required_fields = ["active_sessions", "total_claims", "total_earnings", 
                              "proxy_count", "faucet_count"]
            
            for field in required_fields:
                if field not in data:
                    return False, f"Missing '{field}' field"
            
            return True, f"Stats retrieved successfully: {data['faucet_count']} faucets, {data['proxy_count']} proxies"
            
        return self.run_test(
            "Stats Endpoint",
            "GET",
            "api/stats",
            200,
            check_content=check_stats
        )

    def test_faucets_endpoint(self):
        """Test the faucets endpoint"""
        def check_faucets(data):
            if not isinstance(data, list):
                return False, "Expected a list of faucets"
            
            if len(data) < 20:
                return False, f"Expected at least 20 faucets, got {len(data)}"
            
            # Check first faucet structure
            if len(data) > 0:
                faucet = data[0]
                required_fields = ["id", "name", "url", "claim_selector", "cooldown_minutes", "enabled"]
                for field in required_fields:
                    if field not in faucet:
                        return False, f"Faucet missing '{field}' field"
            
            return True, f"Retrieved {len(data)} faucets successfully"
            
        return self.run_test(
            "Faucets Endpoint",
            "GET",
            "api/faucets",
            200,
            check_content=check_faucets
        )

    def test_sessions_endpoint(self):
        """Test the sessions endpoint"""
        def check_sessions(data):
            if not isinstance(data, list):
                return False, "Expected a list of sessions"
            return True, f"Retrieved {len(data)} sessions"
            
        return self.run_test(
            "Sessions Endpoint",
            "GET",
            "api/sessions",
            200,
            check_content=check_sessions
        )

    def test_refresh_proxies(self):
        """Test the proxy refresh endpoint"""
        def check_proxy_refresh(data):
            if "message" not in data:
                return False, "Missing 'message' field"
            if "count" not in data:
                return False, "Missing 'count' field"
            return True, f"Proxies refreshed: {data['count']} proxies available"
            
        return self.run_test(
            "Proxy Refresh Endpoint",
            "POST",
            "api/proxies/refresh",
            200,
            check_content=check_proxy_refresh
        )

    def test_start_session(self):
        """Test starting a session"""
        # First get available faucets
        _, faucets_data = self.run_test(
            "Get Faucets for Session",
            "GET",
            "api/faucets",
            200
        )
        
        if not faucets_data or not isinstance(faucets_data, list) or len(faucets_data) == 0:
            print("❌ Failed - Could not get faucets to start session")
            return False, {}
            
        # Select first faucet
        faucet_ids = [faucets_data[0]["id"]]
        
        def check_session_start(data):
            if "message" not in data:
                return False, "Missing 'message' field"
            if "session_id" not in data:
                return False, "Missing 'session_id' field"
            return True, f"Session started with ID: {data['session_id']}"
            
        return self.run_test(
            "Start Session Endpoint",
            "POST",
            "api/sessions/start",
            200,
            data=faucet_ids,
            check_content=check_session_start
        )

    def test_stop_session(self, session_id):
        """Test stopping a session"""
        def check_session_stop(data):
            if "message" not in data:
                return False, "Missing 'message' field"
            return True, "Session stopped successfully"
            
        return self.run_test(
            "Stop Session Endpoint",
            "POST",
            f"api/sessions/{session_id}/stop",
            200,
            check_content=check_session_stop
        )

    def test_add_custom_faucet(self):
        """Test adding a custom faucet"""
        custom_faucet = {
            "id": f"test-faucet-{int(time.time())}",
            "name": "Test Faucet",
            "url": "https://example.com/faucet",
            "claim_selector": "#claim-button",
            "captcha_selector": ".captcha-container",
            "cooldown_minutes": 30,
            "enabled": True
        }
        
        def check_faucet_add(data):
            if "message" not in data:
                return False, "Missing 'message' field"
            if "faucet" not in data:
                return False, "Missing 'faucet' field"
            return True, "Custom faucet added successfully"
            
        return self.run_test(
            "Add Custom Faucet Endpoint",
            "POST",
            "api/faucets",
            200,
            data=custom_faucet,
            check_content=check_faucet_add
        )

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print("="*50)
        
        if self.tests_passed == self.tests_run:
            print("✅ All tests passed!")
        else:
            print("❌ Some tests failed:")
            for result in self.test_results:
                if not result.get("success"):
                    print(f"  - {result['name']}")
                    if "error" in result:
                        print(f"    Error: {result['error']}")
                    elif "status_code" in result:
                        print(f"    Status: {result['status_code']} (expected {result['expected_status']})")
                    if "content_message" in result and result["content_message"]:
                        print(f"    Message: {result['content_message']}")
        print("="*50)

def main():
    # Get backend URL from frontend .env
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                backend_url = line.strip().split('=')[1].strip('"\'')
                break
    
    print(f"Using backend URL: {backend_url}")
    
    # Setup tester
    tester = CryptoFaucetTester(backend_url)
    
    # Run tests
    tester.test_health_endpoint()
    tester.test_stats_endpoint()
    tester.test_faucets_endpoint()
    tester.test_sessions_endpoint()
    tester.test_refresh_proxies()
    
    # Test session management
    success, session_data = tester.test_start_session()
    if success and "session_id" in session_data:
        # Wait a bit for session to start
        time.sleep(2)
        tester.test_stop_session(session_data["session_id"])
    
    # Test adding custom faucet
    tester.test_add_custom_faucet()
    
    # Print summary
    tester.print_summary()
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())