"""
Fix: move Welsh cast from 2025-09-19 to 2026-05-29, and create the initiation event.
"""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = "admin@lima-impro.fr"
ADMIN_PASSWORD = "Admin1234!"

SEASON_ID = "fac92c5e-e511-47c3-bb59-0c160e3d7e71"
ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"  # T3 2025-2026

WRONG_WELSH_ID = "92d556f5-76ff-4a04-b442-6dbaad1a60a5"   # 2025-09-19
RIGHT_WELSH_ID = "e5f3aabf-289a-481f-b513-24d37b200007"   # 2026-05-29

HELLOASSO_URL = "https://www.helloasso.com/associations/lima/evenements/dimanche-d-initiation-28-juin-2026"

s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})


def api(method, path, **kwargs):
    r = s.request(method, API_BASE + path, **kwargs)
    if not r.ok:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:400]}")
    return r.json() if r.status_code != 204 else None


# 1. Get alignment details to find wrong assignments
print("=== Step 1: Remove wrong Welsh assignments (2025-09-19) ===")
alignment = api("GET", f"/alignments/{ALIGNMENT_ID}")
removed = 0
for ev_block in alignment.get("events", []):
    if ev_block["event"]["id"] == WRONG_WELSH_ID:
        for asgn in ev_block.get("assignments", []):
            try:
                api("DELETE", f"/alignments/{ALIGNMENT_ID}/assign/{asgn['id']}")
                print(f"  Removed: {asgn.get('member_id', '')} from wrong Welsh")
                removed += 1
            except RuntimeError as e:
                print(f"  ERR removing {asgn['id']}: {e}")
print(f"  {removed} assignments removed from wrong event")

# 2. Assign cast to correct Welsh (2026-05-29)
print("\n=== Step 2: Assign cast to correct Welsh (2026-05-29) ===")

# Get member IDs from already-fetched alignment or member list
import unicodedata

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()

all_members = (api("GET", "/members?is_active=true") or []) + \
              (api("GET", "/members?is_active=false") or [])

def lookup(first, last=None):
    for m in all_members:
        fn = strip_accents(m['first_name'])
        ln = strip_accents(m['last_name'])
        if last:
            if fn == strip_accents(first) and ln == strip_accents(last):
                return m
        else:
            if fn == strip_accents(first):
                return m
    return None

WELSH_CAST = [
    ("Stéphanie", None,       "JR"),
    ("Aurélien",  None,       "JR"),
    ("Jérôme",    "Jacq",     "JR"),
    ("Ronan",     "Michel",   "JR"),
    ("Élodie",    "Audigane", "MJ_MC"),
]

# Link correct Welsh event to alignment first
try:
    api("POST", f"/alignments/{ALIGNMENT_ID}/events", json={"event_ids": [RIGHT_WELSH_ID]})
    print("  Correct Welsh linked to alignment")
except RuntimeError as e:
    print(f"  Already linked or error: {e}")

for first, last, role in WELSH_CAST:
    m = lookup(first, last)
    if not m:
        print(f"  MISSING: {first} {last or ''}")
        continue
    name = f"{m['first_name']} {m['last_name']}"
    try:
        api("POST", f"/alignments/{ALIGNMENT_ID}/assign", json={
            "event_id": RIGHT_WELSH_ID,
            "member_id": m["id"],
            "role": role,
        })
        print(f"  OK  [{role}] {name}")
    except RuntimeError as e:
        if "déjà" in str(e).lower() or "already" in str(e).lower():
            print(f"  SKIP (already assigned): {name}")
        else:
            print(f"  ERR {name}: {e}")

# 3. Create initiation event (28 June 2026) if it doesn't exist
print("\n=== Step 3: Create initiation event (28/06/2026) ===")
events = api("GET", f"/events?season_id={SEASON_ID}") or []
existing = next((e for e in events if "initiation" in e["title"].lower() or
                 (e["start_at"].startswith("2026-06-28"))), None)
if existing:
    print(f"  Already exists: {existing['title']}")
    # Update notes with HelloAsso URL if missing
    notes = existing.get("notes") or ""
    if "helloasso:" not in notes.lower():
        new_notes = f"helloasso: {HELLOASSO_URL}\n{notes}".strip()
        api("PUT", f"/events/{existing['id']}", json={
            "title": existing["title"],
            "event_type": existing["event_type"],
            "start_at": existing["start_at"],
            "notes": new_notes,
        })
        print(f"  Added HelloAsso URL to existing event")
else:
    created = api("POST", "/events", json={
        "season_id": SEASON_ID,
        "title": "Journée d'initiation",
        "event_type": "other",
        "start_at": "2026-06-28T10:00:00",
        "notes": f"helloasso: {HELLOASSO_URL}",
    })
    print(f"  Created: {created['title']} ({created['id']})")

print("\n=== Done!")
