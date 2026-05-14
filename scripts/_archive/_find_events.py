import requests
s = requests.Session()
s.post('https://api-production-e15b.up.railway.app/auth/login',
       json={'email': 'admin@lima-impro.fr', 'password': 'Admin1234!'})
events = s.get('https://api-production-e15b.up.railway.app/events?season_id=fac92c5e-e511-47c3-bb59-0c160e3d7e71').json()

print('=== Welsh events:')
for e in events:
    if 'welsh' in e['title'].lower() or e.get('event_type') == 'welsh':
        print(f"  {e['start_at'][:10]}  {e['title']}  ({e['id']})")

print('\n=== Other/formation events from May 2026:')
for e in events:
    if e['event_type'] in ('other', 'formation') and e['start_at'] >= '2026-05':
        print(f"  {e['start_at'][:10]}  {e['title']}  ({e['id']})")

print('\n=== All events June 2026:')
for e in events:
    if e['start_at'].startswith('2026-06'):
        print(f"  {e['start_at'][:10]}  {e['event_type']}  {e['title']}  ({e['id']})")
