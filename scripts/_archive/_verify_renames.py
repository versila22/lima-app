import requests, json, sys
API = "https://api-production-e15b.up.railway.app"
s = requests.Session()
r = s.post(f"{API}/auth/login", json={"email": "admin@lima-impro.fr", "password": "Admin1234!"})
headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

check_ids = [
    "6379da0b-e3d7-4348-9d4a-3028c530cdf9",  # Gladys -> Héroïne
    "bc4cd311-cef5-486a-abf6-96d67affe10d",  # Nathalie -> VacaVacaHéhé
    "32c15829-25ff-4073-9c3c-3566e95378b2",  # Roxane -> l'arbre à thés
    "b5186a3c-161d-4037-98de-e7b31e0d28ba",  # Elisabeth -> Tromignonne
]

# Use sys.stdout with utf-8 to avoid console encoding issues
sys.stdout.reconfigure(encoding="utf-8")
for mid in check_ids:
    m = s.get(f"{API}/members/{mid}", headers=headers).json()
    print(f"  {m['first_name']} -> last_name='{m['last_name']}'")
