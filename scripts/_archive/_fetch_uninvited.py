import requests, json

API_BASE = "https://api-production-e15b.up.railway.app"
s = requests.Session()
r = s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})
token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

r = s.get(f"{API_BASE}/members/uninvited", headers=headers)
print(f"Status: {r.status_code}")
data = r.json()
print(f"Count: {len(data)}")
print(json.dumps(data, indent=2, ensure_ascii=False))
