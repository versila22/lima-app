import requests
s = requests.Session()
s.post('https://api-production-e15b.up.railway.app/auth/login', json={'email':'admin@lima-impro.fr','password':'Admin1234!'})
seasons = s.get('https://api-production-e15b.up.railway.app/seasons').json()
s2425 = next(ss for ss in seasons if '2024' in ss['name'])
events = s.get('https://api-production-e15b.up.railway.app/events', params={'season_id': s2425['id']}).json()
print(f'{len(events)} events in 2024-2025')
for ev in events[:3]:
    cast = s.get(f'https://api-production-e15b.up.railway.app/events/{ev["id"]}/cast').json()
    print(f'  {ev["title"]}: {len(cast)} cast members', cast[:2] if cast else '')
