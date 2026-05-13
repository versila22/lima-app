"""Promote Jerome Jacq to admin via the correct /role endpoint."""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"

s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})

members = s.get(f"{API_BASE}/members?is_active=true").json()
jerome = next((m for m in members if "jacq" in m.get("last_name", "").lower()), None)
print(f"Jerome: {jerome['id']} - role actuel: {jerome['app_role']}")

r = s.put(f"{API_BASE}/members/{jerome['id']}/role", json={"app_role": "admin"})
data = r.json()
print(f"Update: {r.status_code} - nouveau role: {data.get('app_role')}")
