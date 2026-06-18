"""
Seed members from HelloAsso CSV exports into LIMA via API.
- Imports via POST /members/import (creates members + season enrollment)
  Members are created active with default password 'Lima2526!' — no activation step needed.
- Assigns commissions from the adhesion CSV
Usage: py scripts/seed_members.py
"""

import os
import csv
import requests

COTISATION_CSV = r"C:\Users\jerom\Downloads\export-cotisation-joueur-euse-2025-2026-lima-17_09_2025-31_03_2026.csv"
ADHESION_CSV = r"C:\Users\jerom\Downloads\export-bulletin-d-adhesion-lima-2025-2026-lima-07_09_2025-31_03_2026.csv"
API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = os.environ.get("LIMA_ADMIN_EMAIL", "admin@lima-impro.fr")
ADMIN_PASSWORD = os.environ.get("LIMA_ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise SystemExit("Definis LIMA_ADMIN_PASSWORD dans l'environnement avant de lancer ce script.")
DEFAULT_PASSWORD = "Lima2526!"


# ── Session with cookie jar ───────────────────────────────────────────────────

session = requests.Session()


def api(method, path, **kwargs):
    r = session.request(method, API_BASE + path, **kwargs)
    if not r.ok:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
    return r.json() if r.status_code != 204 else None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # 1. Login
    print("Logging in as admin...")
    api("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    print("  OK")

    # 2. Get current season
    print("Fetching current season...")
    seasons = api("GET", "/seasons")
    current = next((s for s in seasons if s.get("is_current")), None)
    if not current:
        raise RuntimeError("No current season found!")
    season_id = current["id"]
    print(f"  Season: {current['name']} ({season_id})")

    # 3. Import members via CSV
    print("\nImporting members...")
    with open(ADHESION_CSV, "rb") as fa, open(COTISATION_CSV, "rb") as fj:
        report = api(
            "POST",
            f"/members/import?season_id={season_id}",
            files={
                "adherents": ("adherents.csv", fa, "text/csv"),
                "joueurs":   ("joueurs.csv",   fj, "text/csv"),
            },
        )
    print(f"  Created: {report['created']}, Updated: {report['updated']}, Errors: {len(report.get('errors', []))}")
    for err in report.get("errors", []):
        print(f"  ERR: {err}")
    members = report.get("members", [])
    print(f"  Members in report: {len(members)}")
    for m in members:
        print(f"    {m['first_name']} {m['last_name']} <{m['email']}> [{m['player_status']}]")

    # 4. Assign commissions
    print("\nAssigning commissions...")
    commissions = api("GET", "/commissions")
    if not commissions:
        print("  No commissions in DB — skipping.")
        return
    print(f"  DB commissions: {[c['name'] for c in commissions]}")

    # Read commission column from adhesion CSV
    email_to_comm = {}
    with open(ADHESION_CSV, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter=";"):
            email = row.get("Email", "").strip().lower()
            comm_str = row.get("De quelle commission veux-tu faire partie ?", "").strip()
            if email and comm_str and comm_str != "Aucune":
                email_to_comm[email] = comm_str

    # Build member lookup
    all_members = api("GET", "/members")
    member_by_email = {m["email"].lower(): m["id"] for m in all_members}

    comm_ok = 0
    for email, csv_comm in email_to_comm.items():
        member_id = member_by_email.get(email)
        if not member_id:
            print(f"  WARN: member not found for {email}")
            continue

        # Match: DB commission name appears in the CSV value
        matched = next(
            (c for c in commissions if c["name"] in csv_comm or csv_comm.startswith(c["name"][:12])),
            None,
        )
        if not matched:
            print(f"  WARN: no commission match for '{csv_comm}'")
            continue

        try:
            api("POST", f"/commissions/{matched['id']}/members", json={
                "member_id": member_id,
                "season_id": season_id,
            })
            comm_ok += 1
        except RuntimeError as e:
            if "déjà dans cette commission" in str(e):
                pass
            else:
                print(f"  ERR commission {email}: {e}")
    print(f"  Assigned {comm_ok} commission memberships.")

    print("\nDone!")


if __name__ == "__main__":
    main()
