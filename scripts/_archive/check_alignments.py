import requests
s = requests.Session()
s.post('https://api-production-e15b.up.railway.app/auth/login', json={'email':'admin@lima-impro.fr','password':'Admin1234!'})

seasons = s.get('https://api-production-e15b.up.railway.app/seasons').json()
for season in seasons:
    events = s.get('https://api-production-e15b.up.railway.app/events', params={'season_id': season['id']}).json()
    print(f"\n=== {season['name']} (current={season['is_current']}) — {len(events)} events ===")
    for ev in events:
        cast = s.get(f'https://api-production-e15b.up.railway.app/events/{ev["id"]}/cast').json()
        print(f"  [{ev['event_type']:15}] {ev['start_at'][:10]} {ev['title'][:40]} — {len(cast)} cast")

aligns = s.get('https://api-production-e15b.up.railway.app/alignments').json()
print(f"\n=== {len(aligns)} alignments ===")
for a in aligns:
    print(f"  {a['name']} ({a.get('start_date','')} → {a.get('end_date','')})")
