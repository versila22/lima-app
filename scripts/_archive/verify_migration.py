import requests
s = requests.Session()
s.post('https://api-production-e15b.up.railway.app/auth/login', json={'email':'admin@lima-impro.fr','password':'Admin1234!'})

seasons = s.get('https://api-production-e15b.up.railway.app/seasons').json()
for season in seasons:
    events = s.get('https://api-production-e15b.up.railway.app/events', params={'season_id': season['id']}).json()
    march_june = [e for e in events if e['start_at'][:7] in ('2025-03','2025-04','2025-05','2025-06')]
    print(f"{season['name']} (current={season['is_current']}): {len(events)} events, {len(march_june)} T3 events")
    for ev in march_june:
        cast = s.get(f'https://api-production-e15b.up.railway.app/events/{ev["id"]}/cast').json()
        print(f"  {ev['start_at'][:10]} {ev['title'][:45]} — {len(cast)} cast")

aligns = s.get('https://api-production-e15b.up.railway.app/alignments').json()
print(f"\nAlignments: {[(a['name'], a.get('season_id','?')) for a in aligns]}")
