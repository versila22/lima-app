"""List members who have never logged in (no password set yet)."""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"

s = requests.Session()
r = s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})
print(f"Login: {r.status_code}")
token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"} if token else {}

members = s.get(f"{API_BASE}/members?is_active=true", headers=headers).json()
print(f"Total active members: {len(members)}")
# Note: password_hash is internal; we use a different signal. Check /members/{id} extended detail.

# Fetch each member's profile to see if they have password_hash
no_login = []
for m in members:
    detail = s.get(f"{API_BASE}/members/{m['id']}", headers=headers).json()
    # the member detail may include is_activated or last_login
    if not detail.get("is_activated", True):
        no_login.append(m)
    else:
        # fallback: members with no recent activity / no password
        pass

if not no_login:
    print("\nNo `is_activated` flag on member detail. Dumping a sample for inspection:")
    print(members[0] if members else "no members")

print(f"\nMembers without login: {len(no_login)}")
for m in no_login[:20]:
    print(f"  {m['first_name']} {m['last_name']} ({m.get('email','no email')})")
