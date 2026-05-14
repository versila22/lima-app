"""Apply last_name renames from member_renames.csv via PATCH /members/{id}."""
import requests
import sys
from pathlib import Path

API_BASE = "https://api-production-e15b.up.railway.app"
CSV_PATH = Path(__file__).parent / "member_renames.csv"


def decode_cell(b: bytes) -> str:
    """Decode a cell trying UTF-8 then cp1252 (Excel-saved fallback)."""
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("cp1252")


def parse_csv(path: Path) -> list[dict]:
    """Parse the semicolon-separated CSV with mixed UTF-8 / cp1252 encoding."""
    raw = path.read_bytes()
    lines = raw.split(b"\n")
    header = [c.strip().decode("ascii") for c in lines[0].rstrip(b"\r").split(b";")]
    rows = []
    for line in lines[1:]:
        line = line.rstrip(b"\r")
        if not line.strip():
            continue
        cells = line.split(b";")
        if len(cells) < len(header):
            print(f"WARN: skipping malformed line: {decode_cell(line)}")
            continue
        row = {h: decode_cell(c).strip() for h, c in zip(header, cells)}
        rows.append(row)
    return rows


def main():
    rows = parse_csv(CSV_PATH)
    print(f"Loaded {len(rows)} rows from CSV.")

    # Login as admin
    s = requests.Session()
    r = s.post(
        f"{API_BASE}/auth/login",
        json={"email": "admin@lima-impro.fr", "password": "Admin1234!"},
    )
    if not r.ok:
        print(f"Login failed: {r.status_code} {r.text}")
        sys.exit(1)
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Login: {r.status_code}")

    applied = 0
    skipped = 0
    errors = 0
    for row in rows:
        if row.get("apply", "").lower() not in ("oui", "yes", "y", "true", "1"):
            skipped += 1
            continue
        new_last = row.get("new_last_name", "").strip()
        if not new_last:
            print(f"  SKIP empty new_last_name for {row['first_name']} {row['original_last_name']}")
            skipped += 1
            continue
        payload = {"last_name": new_last}
        url = f"{API_BASE}/members/{row['id']}"
        resp = s.put(url, json=payload, headers=headers)
        if resp.ok:
            applied += 1
            print(f"  OK  {row['first_name']} {row['original_last_name']} -> {new_last}")
        else:
            errors += 1
            print(f"  ERR {row['first_name']} {row['original_last_name']} -> {new_last} : {resp.status_code} {resp.text[:200]}")

    print(f"\nDone. Applied={applied} skipped={skipped} errors={errors}")


if __name__ == "__main__":
    main()
