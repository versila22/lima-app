"""Promote Jerome Jacq to admin role."""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"

s = requests.Session()
r = s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})
print(f"Login: {r.status_code}")

# Find Jerome Jacq
members = s.get(f"{API_BASE}/members?is_active=true").json()
jerome = next((m for m in members if m["first_name"] == "Jerome" or (m["first_name"] == "Jérôme" and m["last_name"] == "Jacq")), None)
if not jerome:
    # Try by email
    jerome = next((m for m in members if "jacq" in m.get("email", "").lower() or "jacq" in m.get("last_name", "").lower()), None)
if not jerome:
    print("Jerome Jacq not found! Members with Jacq:")
    for m in members:
        if "jacq" in (m.get("last_name", "") + m.get("email", "")).lower():
            print(f"  {m['first_name']} {m['last_name']} - {m['email']} - role: {m['app_role']}")
    exit(1)

print(f"Found: {jerome['first_name']} {jerome['last_name']} - {jerome['email']} - current role: {jerome['app_role']}")

if jerome["app_role"] == "admin":
    print("Already admin!")
    exit(0)

r = s.patch(f"{API_BASE}/members/{jerome['id']}", json={"app_role": "admin"})
if not r.ok:
    # Try PUT
    r = s.put(f"{API_BASE}/members/{jerome['id']}", json={"app_role": "admin"})
print(f"Update: {r.status_code} - {r.text[:200]}")
