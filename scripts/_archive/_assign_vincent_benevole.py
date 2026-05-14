"""Assign Vincent Marais as BENEVOLE on Le Germoir (retries until backend accepts it)."""
import requests, time

API_BASE     = "https://api-production-e15b.up.railway.app"
ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"
VINCENT_ID   = "631b5436-423f-43e3-922d-53d990f3b6b8"
GERMOIR_ID   = "cb563fbe-aa06-42f9-b2e2-128f53f48671"

s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})

for attempt in range(20):
    r = s.post(f"{API_BASE}/alignments/{ALIGNMENT_ID}/assign", json={
        "event_id": GERMOIR_ID,
        "member_id": VINCENT_ID,
        "role": "BENEVOLE",
    })
    if r.status_code == 201:
        print(f"OK - Vincent Marais assigned as BENEVOLE on Le Germoir (attempt {attempt+1})")
        break
    elif r.status_code in (409,) or "déjà" in r.text.lower():
        print("Already assigned as BENEVOLE - OK!")
        break
    else:
        print(f"Attempt {attempt+1}: {r.status_code} - backend not ready yet, waiting 10s...")
        time.sleep(10)
else:
    print(f"FAILED after 20 attempts: {r.status_code} {r.text}")
