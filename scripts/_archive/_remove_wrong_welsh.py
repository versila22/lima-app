"""Remove assignments from wrong Welsh event (2025-09-19)."""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"
s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})

ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"
WRONG_WELSH_ID = "92d556f5-76ff-4a04-b442-6dbaad1a60a5"

r = s.get(f"{API_BASE}/alignments/{ALIGNMENT_ID}")
alignment = r.json()

assignments = alignment.get("assignments", [])
print(f"Total assignments in alignment: {len(assignments)}")

wrong = [a for a in assignments if a.get("event_id") == WRONG_WELSH_ID]
print(f"Assignments on wrong Welsh: {len(wrong)}")

for asgn in wrong:
    dr = s.delete(f"{API_BASE}/alignments/{ALIGNMENT_ID}/assign/{asgn['id']}")
    print(f"  Deleted {asgn['id']}: {dr.status_code}")

print("Done!")
