"""Check cast of wrong Welsh and clean if needed."""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"
s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})

ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"
WRONG_WELSH_ID = "92d556f5-76ff-4a04-b442-6dbaad1a60a5"
RIGHT_WELSH_ID = "e5f3aabf-289a-481f-b513-24d37b200007"

# Check cast of both Welsh events
for label, eid in [("WRONG Welsh 2025-09-19", WRONG_WELSH_ID), ("RIGHT Welsh 2026-05-29", RIGHT_WELSH_ID)]:
    r = s.get(f"{API_BASE}/events/{eid}/cast")
    cast = r.json() if r.ok else []
    print(f"\n{label}: {len(cast)} cast members")
    for c in cast:
        print(f"  [{c['role']}] {c['first_name']} {c['last_name']}")

# Get alignment details to find assignments on wrong Welsh
print(f"\n=== Alignment detail for wrong Welsh cleanup ===")
r = s.get(f"{API_BASE}/alignments/{ALIGNMENT_ID}")
alignment = r.json()
print(f"Alignment: {alignment.get('name')}")
print(f"Events structure keys: {list(alignment.keys())}")

# Find assignments for wrong Welsh
events_in_alignment = alignment.get("events", [])
print(f"Events in alignment: {len(events_in_alignment)}")
for ev_block in events_in_alignment:
    ev = ev_block.get("event", {})
    if ev.get("id") == WRONG_WELSH_ID:
        print(f"Found wrong Welsh in alignment, assignments: {len(ev_block.get('assignments', []))}")
        for asgn in ev_block.get("assignments", []):
            print(f"  Removing assignment {asgn['id']}...")
            dr = s.delete(f"{API_BASE}/alignments/{ALIGNMENT_ID}/assign/{asgn['id']}")
            print(f"  -> {dr.status_code}")
