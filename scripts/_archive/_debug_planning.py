"""Diagnose /members/me/planning failure."""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"

s = requests.Session()
r = s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})
print(f"Login: {r.status_code}")
if not r.ok:
    print(r.text)
    exit(1)

token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"} if token else {}

print("\n--- /members/me/planning ---")
r = s.get(f"{API_BASE}/members/me/planning", headers=headers)
print(f"Status: {r.status_code}")
print(f"Body (first 4000 chars):")
print(r.text[:4000])
