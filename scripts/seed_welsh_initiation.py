"""
Seed Welsh 29/05/2026 alignment and add HelloAsso link to initiation event.
Usage: python scripts/seed_welsh_initiation.py
"""

import unicodedata
import requests

API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = "admin@lima-impro.fr"
ADMIN_PASSWORD = "Admin1234!"

HELLOASSO_URL = "https://www.helloasso.com/associations/lima/evenements/dimanche-d-initiation-28-juin-2026"

# Welsh cast: (first_name, last_name_or_None, role)
WELSH_CAST = [
    ("Stéphanie", None,       "JR"),
    ("Aurélien",  None,       "JR"),
    ("Jérôme",    "Jacq",     "JR"),
    ("Ronan",     "Michel",   "JR"),
    ("Élodie",    "Audigane", "MJ_MC"),
]

session = requests.Session()
_logged_in = False


def api(method, path, **kwargs):
    global session, _logged_in
    for attempt in range(3):
        try:
            r = session.request(method, API_BASE + path, **kwargs)
            if not r.ok:
                raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:400]}")
            return r.json() if r.status_code != 204 else None
        except requests.exceptions.ConnectionError:
            if attempt == 2:
                raise
            session = requests.Session()
            if _logged_in:
                session.post(API_BASE + "/auth/login",
                             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})


def login():
    global _logged_in
    api("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    _logged_in = True


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').lower()


def build_name_index(members):
    idx = {}
    for m in members:
        key = f"{m['first_name']} {m['last_name']}".casefold()
        idx[key] = m["id"]
        idx[strip_accents(m['first_name'])] = m["id"]
    return idx, members


def lookup(idx, all_members, first, last=None):
    if last:
        key = f"{first} {last}".casefold()
        if key in idx:
            return idx[key]
        stripped = f"{strip_accents(first)} {strip_accents(last)}"
        for k, v in idx.items():
            if strip_accents(k) == stripped:
                return v
    # By first name only
    fn = strip_accents(first)
    for m in all_members:
        if strip_accents(m['first_name']) == fn:
            return m["id"]
    return None


def main():
    print("=== Logging in...")
    login()

    # Find current 2025-2026 season
    seasons = api("GET", "/seasons")
    season = next(
        (s for s in seasons if "2025" in s.get("name", "") and "2026" in s.get("name", "")),
        None
    )
    if not season:
        season = next((s for s in seasons if s.get("is_current")), seasons[0] if seasons else None)
    if not season:
        print("ERROR: No season found!")
        return
    print(f"Season: {season['name']} ({season['id']})")
    season_id = season["id"]

    # Fetch all events in season
    events = api("GET", f"/events?season_id={season_id}") or []
    print(f"{len(events)} events in season")

    # Find Welsh event
    welsh_event = next(
        (e for e in events if "welsh" in e["title"].lower() or e.get("event_type") == "welsh"),
        None
    )
    if not welsh_event:
        print("ERROR: Welsh event not found!")
        return
    print(f"Welsh event: {welsh_event['title']} on {welsh_event['start_at'][:10]} ({welsh_event['id']})")

    # Find initiation event and add HelloAsso URL to its notes
    initiation_event = next(
        (e for e in events if "initiation" in e["title"].lower()),
        None
    )
    if initiation_event:
        notes = initiation_event.get("notes") or ""
        if "helloasso:" not in notes.lower():
            new_notes = f"helloasso: {HELLOASSO_URL}\n{notes}".strip()
            api("PUT", f"/events/{initiation_event['id']}", json={
                "title": initiation_event["title"],
                "event_type": initiation_event["event_type"],
                "start_at": initiation_event["start_at"],
                "notes": new_notes,
            })
            print(f"Updated initiation event '{initiation_event['title']}' with HelloAsso URL")
        else:
            print(f"Initiation event already has HelloAsso URL")
    else:
        print("WARNING: Initiation event not found (title must contain 'initiation')")

    # Find or create alignment for 2025-2026
    aligns = api("GET", "/alignments") or []
    align = next(
        (a for a in aligns
         if "2025" in a.get("name", "") and "2026" in a.get("name", "")),
        None
    )
    if not align:
        print("Creating new alignment T1 2025-2026...")
        align = api("POST", "/alignments", json={
            "season_id": season_id,
            "name": "T1 2025-2026",
            "start_date": "2025-09-01",
            "end_date": "2026-06-30",
        })
        print(f"  Created: {align['name']} ({align['id']})")
    else:
        print(f"Using alignment: {align['name']} ({align['id']})")
    alignment_id = align["id"]

    # Link Welsh event to alignment
    try:
        api("POST", f"/alignments/{alignment_id}/events",
            json={"event_ids": [welsh_event["id"]]})
        print("Welsh event linked to alignment")
    except RuntimeError as e:
        if "already" in str(e).lower() or "déjà" in str(e).lower():
            print("Welsh event already in alignment")
        else:
            print(f"WARNING linking event: {e}")

    # Load all members
    all_members = (api("GET", "/members?is_active=true") or []) + \
                  (api("GET", "/members?is_active=false") or [])
    idx, _ = build_name_index(all_members)
    print(f"{len(all_members)} members loaded")

    # Assign Welsh cast
    print("\n=== Assigning Welsh cast...")
    for first, last, role in WELSH_CAST:
        member_id = lookup(idx, all_members, first, last)
        if not member_id:
            print(f"  MISSING: {first} {last or '(prénom seulement)'}")
            continue
        member = next((m for m in all_members if m["id"] == member_id), None)
        name = f"{member['first_name']} {member['last_name']}" if member else member_id
        try:
            api("POST", f"/alignments/{alignment_id}/assign", json={
                "event_id": welsh_event["id"],
                "member_id": member_id,
                "role": role,
            })
            print(f"  OK  [{role}] {name}")
        except RuntimeError as e:
            if "déjà" in str(e).lower() or "already" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"  SKIP (already assigned): {name}")
            else:
                print(f"  ERR {name}: {e}")

    print("\n=== Done!")


if __name__ == "__main__":
    main()
