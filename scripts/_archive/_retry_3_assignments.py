"""Retry 3 failed assignments from seed_t3_2526."""
import unicodedata, requests, time

API_BASE    = "https://api-production-e15b.up.railway.app"
ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"

s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})

def strip(t):
    return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn').lower()

all_members = (s.get(f"{API_BASE}/members?is_active=true").json() or []) + \
              (s.get(f"{API_BASE}/members?is_active=false").json() or [])

def find(first, last):
    for m in all_members:
        if strip(m['first_name']) == strip(first) and strip(m['last_name']) == strip(last):
            return m['id']
    return None

# Event IDs (from previous run)
events = s.get(f"{API_BASE}/events?season_id=fac92c5e-e511-47c3-bb59-0c160e3d7e71").json()
def ev(title_part, date):
    for e in events:
        if title_part.lower() in e['title'].lower() and e['start_at'].startswith(date):
            return e['id']
    return None

RETRIES = [
    (find("Charlotte", "Vincent"), ev("Blue Monkeys", "2026-05-07"), "JR"),
    (find("Sylvain",   "Lemoine"), ev("Drainguette",  "2026-06-21"), "JR"),
    (find("Antoine",   "Fouchet"), ev("Rennes",       "2026-06-20"), "JR"),
]

for member_id, event_id, role in RETRIES:
    if not member_id or not event_id:
        print(f"  SKIP — member or event not found ({member_id}, {event_id})")
        continue
    for attempt in range(3):
        r = s.post(f"{API_BASE}/alignments/{ALIGNMENT_ID}/assign",
                   json={"event_id": event_id, "member_id": member_id, "role": role})
        if r.status_code == 201:
            print(f"  OK  [{role}] {member_id[:8]} -> {event_id[:8]}")
            break
        elif r.status_code in (409,) or "déjà" in r.text.lower():
            print(f"  SKIP (already assigned)")
            break
        else:
            print(f"  Attempt {attempt+1}: {r.status_code} — retrying...")
            time.sleep(3)
    else:
        print(f"  FAILED after 3 attempts: {r.status_code} {r.text[:100]}")

print("Done!")
