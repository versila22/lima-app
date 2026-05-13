"""
Seed T3 2025-2026 alignments, events and cast into LIMA via API.
Usage: python scripts/seed_t3_2526.py
"""
import unicodedata
import requests

API_BASE    = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = "admin@lima-impro.fr"
ADMIN_PASS  = "Admin1234!"

SEASON_ID    = "fac92c5e-e511-47c3-bb59-0c160e3d7e71"   # 2025-2026
ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"   # T3 2025-2026

# Already-existing event IDs that we only update
GIFFARD_ID = "00788437-32fe-419b-ba59-f805da889468"   # Cabaret Giffard → IMPRO COCKTAILS 18/06
RENNES_ID  = "2f1b9feb-acc0-498f-a9ed-17df0145da11"   # Dépla Rennes 20/06

# ── EVENTS TO CREATE ──────────────────────────────────────────────────────────
NEW_EVENTS = [
    # Cabarets
    {"key": "C1", "title": "Cabaret – Le Germoir",        "event_type": "cabaret", "start_at": "2026-04-18T20:30:00"},
    {"key": "C2", "title": "Cabaret – Blue Monkey",       "event_type": "cabaret", "start_at": "2026-04-23T20:30:00"},
    {"key": "C3", "title": "Impro Cocktails",             "event_type": "cabaret", "start_at": "2026-04-29T19:00:00"},
    {"key": "C4", "title": "Cabaret – Blue Monkeys",      "event_type": "cabaret", "start_at": "2026-05-07T20:30:00"},
    {"key": "C5", "title": "Impro Cocktails",             "event_type": "cabaret", "start_at": "2026-05-21T19:00:00"},
    {"key": "C7", "title": "Cabaret – La Drainguette",    "event_type": "cabaret", "start_at": "2026-06-21T17:00:00"},
    # Matches
    {"key": "M1", "title": "Match Dépla ATH",             "event_type": "match", "start_at": "2026-04-18T20:30:00", "is_away": True, "away_city": "Ath"},
    {"key": "M2", "title": "Match Dépla Paris",           "event_type": "match", "start_at": "2026-04-25T20:30:00", "is_away": True, "away_city": "Paris"},
    # Guignen annulé → pas créé
    {"key": "M4", "title": "Match Dépla Magné",           "event_type": "match", "start_at": "2026-07-21T20:00:00", "is_away": True, "away_city": "Magné"},
]

# Existing events we update (rename + fix time)
EXISTING_UPDATES = {
    GIFFARD_ID: {"title": "Impro Cocktails", "event_type": "cabaret",
                 "start_at": "2026-06-18T19:00:00", "is_away": False},
    RENNES_ID:  {"title": "Match Dépla Rennes", "event_type": "match",
                 "start_at": "2026-06-20T20:30:00", "is_away": True, "away_city": "Rennes"},
}
# Keys for existing events
EXISTING_KEYS = {GIFFARD_ID: "C6", RENNES_ID: "M3"}

# ── CAST DATA ─────────────────────────────────────────────────────────────────
# (first_name, last_name_or_None, event_key, role)
CAST_DATA = [
    # C1 — Germoir 18/04
    ("Karim",       None,           "C1", "JR"),
    ("Rémi",        None,           "C1", "JR"),
    ("Hugues",      "Meerschman",   "C1", "JR"),
    ("Romain",      "Mornet",       "C1", "JR"),
    ("Charlotte",   None,           "C1", "JR"),
    ("François",    "Barraud",      "C1", "MJ_MC"),
    ("Sylvain",     "Lemoine",      "C1", "DJ"),
    ("Vincent",     "Marais",       "C1", "AR"),   # Bénévole → AR (le plus proche)

    # C2 — Blue Monkey 23/04
    ("Aurélien",    None,           "C2", "JR"),
    ("Sylvain",     "Lemoine",      "C2", "JR"),
    ("Maud",        "Ricou",        "C2", "JR"),
    ("Stéphanie",   None,           "C2", "JR"),
    ("Élisabeth",   "Trognon",      "C2", "JR"),
    ("Laure",       "Nafziger",     "C2", "MJ_MC"),
    ("Karim",       None,           "C2", "DJ"),

    # C3 — Impro Cocktails 29/04
    ("Sylvain",     "Lemoine",      "C3", "JR"),
    ("Benoît",      None,           "C3", "JR"),
    ("Céline",      None,           "C3", "JR"),
    ("Jane",        None,           "C3", "JR"),
    ("Maud",        "Ricou",        "C3", "JR"),
    ("Romain",      "Mornet",       "C3", "MJ_MC"),
    ("Simon",       "Galland",      "C3", "DJ"),

    # C4 — Blue Monkeys 07/05
    ("Benoît",      None,           "C4", "JR"),
    ("Romain",      "Mornet",       "C4", "JR"),
    ("Hugues",      "Meerschman",   "C4", "JR"),
    ("Stéphanie",   None,           "C4", "JR"),
    ("Charlotte",   None,           "C4", "JR"),
    ("Emmanuelle",  "Landais",      "C4", "MJ_MC"),
    ("Ronan",       "Michel",       "C4", "DJ"),
    ("Céline",      None,           "C4", "DJ"),

    # C5 — Impro Cocktails 21/05
    ("Karim",       None,           "C5", "JR"),
    ("Rémi",        None,           "C5", "JR"),
    ("Thierry",     None,           "C5", "JR"),
    ("Maud",        "Ricou",        "C5", "JR"),
    ("Stéphanie",   None,           "C5", "JR"),
    ("Antoine",     "Gasnier",      "C5", "MJ_MC"),
    ("Pauline",     None,           "C5", "DJ"),
    ("Marie",       "Trottier",     "C5", "DJ"),

    # C6 — Impro Cocktails 18/06 (ex-Giffard)
    ("Karim",       None,           "C6", "JR"),
    ("Romain",      "Mornet",       "C6", "JR"),
    ("Thierry",     None,           "C6", "JR"),
    ("Stéphanie",   None,           "C6", "JR"),
    ("Élisabeth",   "Trognon",      "C6", "JR"),
    ("Emmanuelle",  "Landais",      "C6", "MJ_MC"),
    ("Maud",        "Ricou",        "C6", "DJ"),

    # C7 — Drainguette 21/06
    ("Rémi",        None,           "C7", "JR"),
    ("Sylvain",     "Lemoine",      "C7", "JR"),
    ("Romain",      "Mornet",       "C7", "JR"),
    ("Céline",      None,           "C7", "JR"),
    ("Élisabeth",   "Trognon",      "C7", "JR"),
    ("Marie",       "Trottier",     "C7", "MJ_MC"),
    ("Pauline",     None,           "C7", "DJ"),
    ("Stéphanie",   None,           "C7", "DJ"),

    # M1 — ATH 18/04
    ("Élodie",      "Audigane",     "M1", "JR"),
    ("François",    "Barraud",      "M1", "JR"),
    ("Jérôme",      "Jacq",         "M1", "JR"),
    ("Valentin",    "Trognon",      "M1", "JR"),
    ("Vincent",     "Marais",       "M1", "JR"),

    # M2 — Paris 25/04
    ("Pauline",     None,           "M2", "JR"),
    ("Ronan",       "Michel",       "M2", "JR"),
    ("Nicolas",     "Zigon",        "M2", "JR"),
    ("Élodie",      "Audigane",     "M2", "JR"),
    ("Vincent",     "Marais",       "M2", "JR"),

    # M3 — Rennes 20/06
    ("Vincent",     "Marais",       "M3", "JR"),
    ("Valentin",    "Trognon",      "M3", "JR"),
    ("Laure",       "Nafziger",     "M3", "JR"),
    ("Antoine",     "Fouchet",      "M3", "JR"),
    ("Ronan",       "Michel",       "M3", "JR"),

    # M4 — Magné 21/07
    ("Élodie",      "Audigane",     "M4", "JR"),
    ("Ronan",       "Michel",       "M4", "JR"),
    ("Marie",       "Trottier",     "M4", "JR"),
    ("Simon",       "Galland",      "M4", "JR"),
    ("Guillaume",   "Huchet",       "M4", "JR"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────
session = requests.Session()

def api(method, path, **kwargs):
    r = session.request(method, API_BASE + path, **kwargs)
    if not r.ok:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
    return r.json() if r.status_code != 204 else None

def strip(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').lower()

def lookup(members, first, last=None):
    """Return best-matching member dict or None."""
    for m in members:
        fn = strip(m['first_name']); ln = strip(m['last_name'])
        if last:
            if fn == strip(first) and ln == strip(last):
                return m
        else:
            if fn == strip(first):
                return m
    return None

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    print("=== Login")
    api("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})

    # ── 1. Load all members ──
    all_members = (api("GET", "/members?is_active=true") or []) + \
                  (api("GET", "/members?is_active=false") or [])
    print(f"{len(all_members)} members loaded")

    # Pre-check unknowns
    print("\n=== Member lookup check")
    unique = {(f, l) for f, l, *_ in CAST_DATA}
    missing = []
    for first, last in sorted(unique):
        m = lookup(all_members, first, last)
        if m:
            print(f"  OK  {first} {last or '(prenom)'} -> {m['first_name']} {m['last_name']}")
        else:
            print(f"  !!  NOT FOUND: {first} {last or '(prénom seulement)'}")
            missing.append((first, last))

    if missing:
        print(f"\n⚠  {len(missing)} membre(s) introuvable(s) — leur casting sera ignoré.")
        print("   Vérifie les prénoms dans la liste des membres.")

    # ── 2. Get existing events to detect duplicates ──
    existing = api("GET", f"/events?season_id={SEASON_ID}") or []
    existing_by_title_date = {
        (e["title"].lower(), e["start_at"][:10]): e["id"]
        for e in existing
    }

    # ── 3. Update existing events (rename + time fix) ──
    print("\n=== Update existing events")
    for eid, patch in EXISTING_UPDATES.items():
        try:
            api("PUT", f"/events/{eid}", json=patch)
            print(f"  Updated {patch['title']} ({eid[:8]}…)")
        except RuntimeError as e:
            print(f"  ERR updating {eid[:8]}: {e}")

    # ── 4. Create new events ──
    print("\n=== Create new events")
    event_ids = {GIFFARD_ID: "C6", RENNES_ID: "M3"}  # reverse: key→id
    key_to_id = {"C6": GIFFARD_ID, "M3": RENNES_ID}

    for ev in NEW_EVENTS:
        key = ev["key"]
        payload = {k: v for k, v in ev.items() if k != "key"}
        payload["season_id"] = SEASON_ID
        date_key = (payload["title"].lower(), payload["start_at"][:10])
        if date_key in existing_by_title_date:
            eid = existing_by_title_date[date_key]
            key_to_id[key] = eid
            print(f"  EXISTS  {payload['title']} ({payload['start_at'][:10]})")
        else:
            created = api("POST", "/events", json=payload)
            key_to_id[key] = created["id"]
            print(f"  CREATED {payload['title']} ({payload['start_at'][:10]})")

    # ── 5. Link all events to alignment ──
    print("\n=== Link events to alignment T3 2025-2026")
    all_event_ids = list(key_to_id.values())
    try:
        api("POST", f"/alignments/{ALIGNMENT_ID}/events",
            json={"event_ids": all_event_ids})
        print(f"  {len(all_event_ids)} events linked (duplicates ignored by API)")
    except RuntimeError as e:
        print(f"  WARN: {e}")

    # ── 6. Assign cast ──
    print("\n=== Assign cast")
    ok = skipped = errors = 0
    for first, last, ev_key, role in CAST_DATA:
        event_id = key_to_id.get(ev_key)
        if not event_id:
            skipped += 1
            continue
        m = lookup(all_members, first, last)
        if not m:
            print(f"  SKIP (member not found): {first} {last or ''}")
            skipped += 1
            continue
        name = f"{m['first_name']} {m['last_name']}"
        try:
            api("POST", f"/alignments/{ALIGNMENT_ID}/assign", json={
                "event_id": event_id,
                "member_id": m["id"],
                "role": role,
            })
            ok += 1
        except RuntimeError as e:
            s = str(e).lower()
            if "déjà" in s or "already" in s or "duplicate" in s or "409" in s:
                skipped += 1
            else:
                print(f"  ERR [{role}] {name} -> {ev_key}: {e}")
                errors += 1

    print(f"\n  Assigned: {ok}  Skipped/missing: {skipped}  Errors: {errors}")
    print("\n=== Done!")

if __name__ == "__main__":
    main()
