"""
Move T3 alignment + events from incorrectly-created "2024-2025" season
to the existing "2025-2026" season, then delete the stale season.
"""
import requests

API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = "admin@lima-impro.fr"
ADMIN_PASSWORD = "Admin1234!"

s = requests.Session()
s.post(API_BASE + "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})

def api(method, path, **kwargs):
    r = s.request(method, API_BASE + path, **kwargs)
    if not r.ok:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
    return r.json() if r.status_code != 204 else None

seasons = api("GET", "/seasons")
season_2526 = next(ss for ss in seasons if "2025" in ss["name"] and "2026" in ss["name"])
season_2425 = next((ss for ss in seasons if "2024" in ss["name"] and "2025" in ss["name"]), None)

print(f"Target season: {season_2526['name']} ({season_2526['id']})")
if not season_2425:
    print("No 2024-2025 season found — nothing to migrate.")
    exit(0)
print(f"Source season: {season_2425['name']} ({season_2425['id']})")

# Move each event to 2025-2026
events_2425 = api("GET", "/events", params={"season_id": season_2425["id"]}) or []
print(f"\n{len(events_2425)} events to migrate:")
for ev in events_2425:
    api("PUT", f"/events/{ev['id']}", json={
        "season_id": season_2526["id"],
        "title": ev["title"],
        "event_type": ev["event_type"],
        "start_at": ev["start_at"],
        "end_at": ev.get("end_at"),
        "is_away": ev.get("is_away", False),
        "away_city": ev.get("away_city"),
        "away_opponent": ev.get("away_opponent"),
        "notes": ev.get("notes"),
    })
    print(f"  Moved: {ev['start_at'][:10]} {ev['title']}")

# Update the alignment name and season
aligns = api("GET", "/alignments") or []
t3 = next((a for a in aligns if "T3" in a.get("name", "")), None)
if t3:
    api("PUT", f"/alignments/{t3['id']}", json={
        "season_id": season_2526["id"],
        "name": "T3 2025-2026",
        "start_date": t3.get("start_date", "2025-03-28"),
        "end_date": t3.get("end_date", "2025-07-31"),
    })
    print(f"\nAlignment renamed to 'T3 2025-2026' and moved to {season_2526['name']}")

# Delete the stale 2024-2025 season
try:
    api("DELETE", f"/seasons/{season_2425['id']}")
    print(f"Deleted season '{season_2425['name']}'")
except RuntimeError as e:
    print(f"Could not delete season: {e}")

print("\nDone!")
