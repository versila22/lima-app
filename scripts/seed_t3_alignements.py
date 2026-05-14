"""
Seed T3 2024-2025 alignments into LIMA via API.
Creates: season 2024-2025, 9 events, alignment T3, and all assignments from PDF.
Usage: py scripts/seed_t3_alignements.py
"""

import requests

API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = "admin@lima-impro.fr"
ADMIN_PASSWORD = "Admin1234!"

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
            # Reconnect and re-login
            session = requests.Session()
            if _logged_in:
                session.post(API_BASE + "/auth/login",
                             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})


def login():
    global _logged_in
    api("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    _logged_in = True


EVENTS_DATA = [
    {
        "key": "E1",
        "title": "Maestro Battle Royale - Folies Angevines",
        "event_type": "match",
        "start_at": "2025-03-28T20:00:00",
        "is_away": False,
    },
    {
        "key": "E2",
        "title": "Match MPT Les Affranchis",
        "event_type": "match",
        "start_at": "2025-03-29T20:00:00",
        "is_away": True,
        "away_city": "Compiègne",
        "away_opponent": "Les Affranchis",
    },
    {
        "key": "E3",
        "title": "Match – 30 ans LIMA (vendredi)",
        "event_type": "match",
        "start_at": "2025-04-25T20:00:00",
        "is_away": False,
    },
    {
        "key": "E4",
        "title": "Cabaret – 30 ans LIMA",
        "event_type": "cabaret",
        "start_at": "2025-04-26T16:30:00",
        "end_at": "2025-04-26T18:00:00",
        "is_away": False,
    },
    {
        "key": "E5",
        "title": "Match – 30 ans LIMA (samedi)",
        "event_type": "match",
        "start_at": "2025-04-26T20:00:00",
        "is_away": False,
    },
    {
        "key": "E6",
        "title": "Match Dépla Quimper",
        "event_type": "match",
        "start_at": "2025-05-03T20:00:00",
        "is_away": True,
        "away_city": "Quimper",
    },
    {
        "key": "E7",
        "title": "Impro Cocktails",
        "event_type": "other",
        "start_at": "2025-05-15T20:00:00",
        "is_away": False,
    },
    {
        "key": "E9",
        "title": "Match Dépla Rueil-Malmaison",
        "event_type": "match",
        "start_at": "2025-05-24T20:00:00",
        "is_away": True,
        "away_city": "Rueil-Malmaison",
    },
    {
        "key": "E10",
        "title": "Impro Cocktails (juin)",
        "event_type": "other",
        "start_at": "2025-06-13T20:00:00",
        "is_away": False,
    },
]

# (first_name, last_name, event_key, role)
CAST_DATA = [
    # Joueurs CABARETS
    ("Samuel",      "Balverde",     "E10", "JR"),
    ("Antoine",     "Blin",         "E4",  "JR"),
    ("Maïlys",      "Dupont",       "E4",  "JR"),
    ("Guillaume",   "Huchet",       "E7",  "JR"),
    ("Guillaume",   "Huchet",       "E10", "JR"),
    ("Karim",       "Jamet",        "E7",  "JR"),
    ("Sylvain",     "Lemoine",      "E7",  "JR"),
    ("Hugues",      "Meerschman",   "E4",  "JR"),
    ("Romain",      "Mornet",       "E4",  "JR"),
    ("Pierre",      "Paineau",      "E7",  "JR"),
    ("Maud",        "Ricou",        "E7",  "JR"),
    ("Maud",        "Ricou",        "E10", "JR"),
    ("Élisabeth",   "Trognon",      "E4",  "JR"),
    ("Élisabeth",   "Trognon",      "E10", "JR"),
    # Joueurs MATCHS
    ("Élodie",      "Audigane",     "E2",  "JR"),
    ("Élodie",      "Audigane",     "E5",  "JR"),
    ("Élodie",      "Audigane",     "E7",  "DJ"),
    ("François",    "Barraud",      "E2",  "JR"),
    ("Eric",        "Cremers",      "E10", "MJ_MC"),
    ("Carole",      "Davy Favret",  "E9",  "JR"),
    ("Antoine",     "Fouchet",      "E1",  "JR"),
    ("Antoine",     "Fouchet",      "E2",  "JR"),
    ("Antoine",     "Fouchet",      "E9",  "MJ_MC"),
    ("Simon",       "Galland",      "E2",  "JR"),
    ("Simon",       "Galland",      "E4",  "DJ"),
    ("Simon",       "Galland",      "E6",  "JR"),
    ("Cécile",      "Hubert",       "E5",  "JR"),
    ("Cécile",      "Hubert",       "E10", "DJ"),
    ("Jérôme",      "Jacq",         "E2",  "DJ"),
    ("Jérôme",      "Jacq",         "E6",  "JR"),
    ("Vincent",     "Marais",       "E2",  "MJ_MC"),
    ("Vincent",     "Marais",       "E5",  "JR"),
    ("Ronan",       "Michel",       "E2",  "JR"),
    ("Ronan",       "Michel",       "E9",  "JR"),
    ("Laure",       "Nafziger",     "E3",  "DJ"),
    ("Laure",       "Nafziger",     "E6",  "JR"),
    ("Laure",       "Nafziger",     "E7",  "MJ_MC"),
    ("Valentin",    "Trognon",      "E5",  "JR"),
    ("Valentin",    "Trognon",      "E6",  "JR"),
    ("Marie",       "Trottier",     "E2",  "JR"),
    ("Marie",       "Trottier",     "E5",  "DJ"),
    ("Marie",       "Trottier",     "E9",  "JR"),
    ("Maxime",      "Vrillaud",     "E6",  "JR"),
    ("Maxime",      "Vrillaud",     "E9",  "JR"),
    ("Nicolas",     "Zigon",        "E3",  "DJ"),
    ("Nicolas",     "Zigon",        "E9",  "JR"),
    # Footer rows: Manue=Emmanuelle Landais, Antoine=Antoine Gasnier
    ("Emmanuelle",  "Landais",      "E2",  "AR"),
    ("Emmanuelle",  "Landais",      "E3",  "JR"),
    ("Antoine",     "Gasnier",      "E3",  "AR"),
    ("Antoine",     "Gasnier",      "E9",  "COACH"),
    # Sylvain B (MJ-MC E5) - Sylvain Bellevue? skip if not found
    # Xavier C. - not in member list, skipped
]


def build_name_index(members):
    idx = {}
    for m in members:
        # normalized key: "prénom nom" lowercase, accents stripped via casefold
        key = f"{m['first_name']} {m['last_name']}".casefold()
        idx[key] = m["id"]
        # Also index by first name alone for ambiguous cases
        idx[m["first_name"].casefold()] = m["id"]
    return idx


def lookup(idx, first, last):
    key = f"{first} {last}".casefold()
    if key in idx:
        return idx[key]
    # Try accent-insensitive partial: strip common accents
    import unicodedata
    def strip(s):
        return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
    stripped_key = f"{strip(first)} {strip(last)}"
    for k, v in idx.items():
        if strip(k) == stripped_key:
            return v
    # Try just first name
    for k, v in idx.items():
        if k.startswith(first.casefold()):
            return v
    return None


def main():
    print("Logging in...")
    login()

    # Get or create 2024-2025 season
    seasons = api("GET", "/seasons")
    season = next((s for s in seasons if "2024" in s["name"]), None)
    if not season:
        print("Creating 2024-2025 season...")
        season = api("POST", "/seasons", json={
            "name": "2024-2025",
            "start_date": "2024-09-01",
            "end_date": "2025-06-30",
            "is_current": False,
        })
    print(f"Season: {season['name']} ({season['id']})")
    season_id = season["id"]

    # Create events
    print("\nCreating events...")
    existing = {e["title"]: e["id"] for e in (api("GET", f"/events?season_id={season_id}") or [])}
    event_ids = {}
    for ev in EVENTS_DATA:
        key = ev["key"]
        payload = {k: v for k, v in ev.items() if k != "key"}
        payload["season_id"] = season_id
        if payload["title"] in existing:
            event_ids[key] = existing[payload["title"]]
            print(f"  EXISTS  {payload['title']}")
        else:
            created = api("POST", "/events", json=payload)
            event_ids[key] = created["id"]
            print(f"  CREATED {payload['title']}")

    # Create alignment
    print("\nAlignment...")
    aligns = api("GET", "/alignments") or []
    align = next((a for a in aligns if "T3" in a["name"] and "2024" in a["name"]), None)
    if not align:
        align = api("POST", "/alignments", json={
            "season_id": season_id,
            "name": "T3 2024-2025",
            "start_date": "2025-03-28",
            "end_date": "2025-06-13",
        })
        print(f"  Created: {align['id']}")
    else:
        print(f"  Exists:  {align['id']}")
    alignment_id = align["id"]

    # Add events to alignment
    api("POST", f"/alignments/{alignment_id}/events", json={"event_ids": list(event_ids.values())})
    print(f"  {len(event_ids)} events linked")

    # Build member index (active + inactive)
    all_members = (api("GET", "/members?is_active=true") or []) + (api("GET", "/members?is_active=false") or [])
    idx = build_name_index(all_members)
    print(f"\n{len(all_members)} members loaded")

    # Assign cast
    print("\nAssigning cast...")
    ok = skipped = errors = 0
    for first, last, ev_key, role in CAST_DATA:
        event_id = event_ids.get(ev_key)
        if not event_id:
            skipped += 1
            continue
        member_id = lookup(idx, first, last)
        if not member_id:
            print(f"  MISSING member: {first} {last}")
            skipped += 1
            continue
        try:
            api("POST", f"/alignments/{alignment_id}/assign", json={
                "event_id": event_id,
                "member_id": member_id,
                "role": role,
            })
            ok += 1
        except RuntimeError as e:
            if "déjà" in str(e).lower() or "already" in str(e).lower() or "duplicate" in str(e).lower():
                skipped += 1
            else:
                print(f"  ERR {first} {last} {ev_key} {role}: {e}")
                errors += 1

    print(f"\nAssigned: {ok}  Skipped/missing: {skipped}  Errors: {errors}")
    print("Done!")


if __name__ == "__main__":
    main()
