"""Check referential integrity, annual coverage and the counts drawn in the offline page."""
import base64
import csv
import gzip
import json
import re
from collections import Counter,defaultdict
from pathlib import Path

p=Path(__file__).resolve().parents[1]
def read(n):
    with (p/(n+'.csv')).open(encoding='utf-8-sig') as f:return list(csv.DictReader(f))
ch=read('chart_entries');so=read('songs');ar=read('artists');ge=read('genres');ly=read('lyrics');cr=read('song_artists')
ids=lambda rows,k:{r[k] for r in rows}
songs=ids(so,'song_id');artists=ids(ar,'artist_id');entries=ids(ch,'entry_id')
assert len(entries)==len(ch)==6501 and len(songs)==len(so) and len(artists)==len(ar)
assert ids(ch,'song_id')==ids(cr,'song_id')==ids(ly,'song_id')==songs and len(ly)==len(songs)
assert ids(cr,'artist_id')==artists and len(cr)==len({(r['song_id'],r['artist_id']) for r in cr})
assert ids(ge,'entry_id')==entries and len(ge)==len(ch)
assert all(r['artist_credit'].strip() and '§' not in r['artist_credit'] for r in ch)
assert all(r['source_url'] and r['origin_type'] for r in ar if r['country_code'])
assert all(r['source_url'] and r['source_title'] for r in ge if r['genres'])
assert all(r['lyrics'].strip() and r['source_url'] for r in ly if r['status']=='usable')
assert all(len(r['lyrics'])<30001 and '/Rap-critic-' not in r['source_url'] for r in ly)
by=defaultdict(list)
for r in ch:by[int(r['year'])].append(r)
assert sorted(by)==list(range(1959,2024))
for y,rs in by.items():
    expected=Counter(range(1,101));expected[100]+=int(y==1969)
    assert Counter(int(r['rank']) for r in rs)==expected
assert next(r for r in by[1964] if r['rank']=='2')['artist_credit']=='The Beatles'
rows=read('coverage');html=(p/'explorer.html').read_text()
packed=re.search(r'<script id="packed"[^>]*>([^<]+)</script>',html)[1]
data=json.loads(gzip.decompress(base64.b64decode(packed)));assert len(data['songs'])==len(songs)
valid=ids([r for r in ly if r['status']=='usable'],'song_id')
known=ids([r for r in ge if r['genres']],'entry_id')
for c in rows:
    y=int(c['year']);rs=by[y]
    assert len(data['years'][str(y)])==int(c['chart_entries'])==len(rs)
    assert sum(r['song_id'] in valid for r in rs)==int(c['lyrics_usable'])
    assert sum(r['entry_id'] in known for r in rs)==int(c['genre_known'])
    assert 0<int(c['artists_origin_known'])<=int(c['distinct_artists'])
assert all(a[1] in data['geo'][1] for a in data['artists'] if a[1])
for word in ['love','hope','hate']:
    counts=data['words'][word]
    for idx,n in zip(counts[::2],counts[1::2]):assert n>0 and data['songs'][idx][4]=='en'
print(f'Passed: {len(rows)} years, {len(entries)} entries, {len(songs)} song units, {len(artists)} artists, chart/lyrics/genre/artist coverage and searchable word indices.')
