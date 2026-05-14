"""Update Vincent Marais Germoir assignment from AR to BENEVOLE."""
import requests

API_BASE     = "https://api-production-e15b.up.railway.app"
ALIGNMENT_ID = "274376d3-5404-4aa1-aba8-631f9139ca28"

s = requests.Session()
s.post(f"{API_BASE}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})

# Get alignment detail to find Vincent's assignment on Germoir
r = s.get(f"{API_BASE}/alignments/{ALIGNMENT_ID}")
data = r.json()

# Find Vincent's member ID
members = s.get(f"{API_BASE}/members?is_active=true").json()
vincent = next((m for m in members if m["first_name"] == "Vincent" and m["last_name"] == "Marais"), None)
if not vincent:
    print("Vincent Marais not found!")
    exit(1)

# Find Germoir event
events = s.get(f"{API_BASE}/events?season_id=fac92c5e-e511-47c3-bb59-0c160e3d7e71").json()
germoir = next((e for e in events if "germoir" in e["title"].lower()), None)
if not germoir:
    print("Germoir event not found!")
    exit(1)

print(f"Vincent: {vincent['id']}")
print(f"Germoir: {germoir['id']}")

# Find the AR assignment for Vincent on Germoir
assignments = data.get("assignments", [])
target = next(
    (a for a in assignments
     if a["member_id"] == vincent["id"]
     and a["event_id"] == germoir["id"]
     and a["role"] == "AR"),
    None
)

if not target:
    print("AR assignment not found for Vincent on Germoir (maybe already fixed?)")
    # Check what assignment exists
    existing = [a for a in assignments if a["member_id"] == vincent["id"] and a["event_id"] == germoir["id"]]
    for a in existing:
        print(f"  Existing: role={a['role']}, id={a['id']}")
    exit(0)

# Delete the AR assignment
dr = s.delete(f"{API_BASE}/alignments/{ALIGNMENT_ID}/assign/{target['id']}")
print(f"Deleted AR assignment: {dr.status_code}")

# Re-assign as BENEVOLE
cr = s.post(f"{API_BASE}/alignments/{ALIGNMENT_ID}/assign", json={
    "event_id": germoir["id"],
    "member_id": vincent["id"],
    "role": "BENEVOLE",
})
print(f"Created BENEVOLE assignment: {cr.status_code}")
if cr.ok:
    print("Done! Vincent Marais is now Bénévole on Le Germoir.")
else:
    print(f"Error: {cr.text}")
