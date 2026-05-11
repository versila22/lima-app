"""
Seed members from HelloAsso CSV exports into LIMA via API.
- Imports via POST /members/import (creates members + season enrollment)
- Activates all new accounts with a default password
- Assigns commissions from the adhesion CSV
Usage: py scripts/seed_members.py
"""

import csv
import http.cookiejar
import json
import urllib.error
import urllib.request

COTISATION_CSV = r"C:\Users\jerom\Downloads\export-cotisation-joueur-euse-2025-2026-lima-17_09_2025-31_03_2026.csv"
ADHESION_CSV = r"C:\Users\jerom\Downloads\export-bulletin-d-adhesion-lima-2025-2026-lima-07_09_2025-31_03_2026.csv"
API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = "admin@lima-impro.fr"
ADMIN_PASSWORD = "Admin1234!"
DEFAULT_PASSWORD = "Lima2526!"


# ── Helpers ───────────────────────────────────────────────────────────────────

def api(jar, method, path, body=None):
    url = API_BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    try:
        with opener.open(req) as r:
            return json.loads(r.read()) if r.status != 204 else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()}")


def api_multipart(jar, path, fields):
    """POST multipart/form-data. fields: {name: (filename, bytes, content_type)} or {name: value}."""
    boundary = b"----LimaBoundary7MA4YWxkTrZu0gW"
    parts = []
    for name, value in fields.items():
        if isinstance(value, tuple):
            filename, content, ctype = value
            parts.append(
                b"--" + boundary + b"\r\n"
                + f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
                + f"Content-Type: {ctype}\r\n\r\n".encode()
                + (content if isinstance(content, bytes) else content.encode("utf-8"))
                + b"\r\n"
            )
        else:
            parts.append(
                b"--" + boundary + b"\r\n"
                + f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
                + str(value).encode()
                + b"\r\n"
            )
    parts.append(b"--" + boundary + b"--\r\n")
    data = b"".join(parts)
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary.decode()}",
        "Accept": "application/json",
        "Content-Length": str(len(data)),
    }
    req = urllib.request.Request(API_BASE + path, data=data, headers=headers, method="POST")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    try:
        with opener.open(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"POST {path} -> {e.code}: {e.read().decode()}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # 1. Login
    print("Logging in as admin...")
    jar = http.cookiejar.CookieJar()
    api(jar, "POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    print("  OK")

    # 2. Get current season
    print("Fetching current season...")
    seasons = api(jar, "GET", "/seasons")
    current = next((s for s in seasons if s.get("is_current")), None)
    if not current:
        raise RuntimeError("No current season found!")
    season_id = current["id"]
    print(f"  Season: {current['name']} ({season_id})")

    # 3. Import members via CSV
    print("\nImporting members...")
    with open(ADHESION_CSV, "rb") as f:
        adherents_bytes = f.read()
    with open(COTISATION_CSV, "rb") as f:
        joueurs_bytes = f.read()

    report = api_multipart(jar, f"/members/import?season_id={season_id}", {
        "adherents": ("adherents.csv", adherents_bytes, "text/csv"),
        "joueurs":   ("joueurs.csv",   joueurs_bytes,   "text/csv"),
    })
    print(f"  Created: {report['created']}, Updated: {report['updated']}, Errors: {len(report.get('errors', []))}")
    for err in report.get("errors", []):
        print(f"  ERR: {err}")

    # 4. Activate new members with default password
    new_members = [m for m in report.get("members", []) if not m.get("is_active", True)]
    # Actually, is_active is set to False for new (unactivated) members
    # But the report includes all processed members; we try resend-activation for all
    print(f"\nActivating {len(report.get('members', []))} members with default password...")
    activated = 0
    skipped = 0
    errors = 0
    for m in report.get("members", []):
        try:
            result = api(jar, "POST", f"/members/{m['id']}/resend-activation")
            token = result["token"]
            api(jar, "POST", "/auth/activate", {"token": token, "password": DEFAULT_PASSWORD})
            activated += 1
            print(f"  ACTIVATED {m['first_name']} {m['last_name']}")
        except RuntimeError as e:
            msg = str(e)
            if "déjà activé" in msg:
                skipped += 1
            else:
                errors += 1
                print(f"  ERR {m['email']}: {msg[:120]}")
    print(f"  Activated: {activated}, Skipped (already active): {skipped}, Errors: {errors}")

    # 5. Assign commissions
    print("\nAssigning commissions...")
    commissions = api(jar, "GET", "/commissions")
    if not commissions:
        print("  No commissions found in DB — skipping.")
        return
    print(f"  DB commissions: {[c['name'] for c in commissions]}")

    # Read commission data from adhesion CSV
    email_to_comm = {}
    with open(ADHESION_CSV, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter=";"):
            email = row.get("Email", "").strip().lower()
            comm_str = row.get("De quelle commission veux-tu faire partie ?", "").strip()
            if email and comm_str and comm_str != "Aucune":
                email_to_comm[email] = comm_str

    # Build member lookup by email
    all_members = api(jar, "GET", "/members")
    member_by_email = {m["email"].lower(): m["id"] for m in all_members}

    comm_ok = 0
    for email, csv_comm in email_to_comm.items():
        member_id = member_by_email.get(email)
        if not member_id:
            print(f"  WARN: member not found for {email}")
            continue

        # Match: find DB commission whose name appears in the CSV value
        matched = next(
            (c for c in commissions if c["name"] in csv_comm or csv_comm.startswith(c["name"][:12])),
            None,
        )
        if not matched:
            print(f"  WARN: no commission match for '{csv_comm}'")
            continue

        try:
            api(jar, "POST", f"/commissions/{matched['id']}/members", {
                "member_id": member_id,
                "season_id": season_id,
            })
            comm_ok += 1
        except RuntimeError as e:
            if "déjà dans cette commission" in str(e):
                pass  # idempotent
            else:
                print(f"  ERR commission {email}: {e}")
    print(f"  Assigned {comm_ok} commission memberships.")

    print("\nDone!")


if __name__ == "__main__":
    main()
