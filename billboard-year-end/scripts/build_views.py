"""Derive annual coverage, normalized word counts and the offline chart payload."""
import base64
import csv
import gzip
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

import langid
from babel import Locale
from measure_lyrics import clean_lyric_text, lyric_tokens

root=Path(__file__).resolve().parents[1]
cache=Path(sys.argv[1])
csv.field_size_limit(8_000_000)
def read(name):
    with (root/(name+'.csv')).open(encoding='utf-8-sig') as f:return list(csv.DictReader(f))
def write(name,fields,rows):
    with (root/(name+'.csv')).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)

def geometry():
    shapes=[];points={}
    for file in ('world50.geojson','world.geojson'):
        for f in json.loads((cache/file).read_text())['features']:
            p=f['properties'];iso=p.get('ISO_A2_EH',p['ISO_A2'])
            if iso in ('-99','AQ'):continue
            points[iso]=[round(p['LABEL_X'],2),round(p['LABEL_Y'],2)]
            if file!='world.geojson':continue
            g=f['geometry'];poly=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
            path=''
            for polygon in poly:
                for ring in polygon:
                    path+='M'+'L'.join(f'{x+180:.1f},{83-y:.1f}' for x,y in ring)+'Z'
            shapes.append([iso,path])
    return [shapes,points]

def main():
    entries=read('chart_entries');songs=read('songs');artists=read('artists');credits=read('song_artists')
    lyrics={r['song_id']:r for r in read('lyrics')};genres={r['entry_id']:r['genres'].split('|') if r['genres'] else [] for r in read('genres')}
    aidx={r['artist_id']:i for i,r in enumerate(artists)}
    links=defaultdict(list)
    for r in read('song_links'):links[r['song_id']].append(r['wiki_title'])
    sidx={r['song_id']:i for i,r in enumerate(songs)}
    singers=defaultdict(list)
    for r in credits:singers[r['song_id']].append(aidx[r['artist_id']])
    lex=defaultdict(list);track=[];qualities=[];countries=Locale.parse('zh').territories
    lang_cache=cache/'language-cache.json'
    languages=json.loads(lang_cache.read_text()) if lang_cache.exists() else {}
    for idx,s in enumerate(songs):
        sid=s['song_id'];ly=lyrics[sid];raw=ly['lyrics'];text=re.sub(r'\[[^\]]{0,200}\]',' ',raw)
        lang='';tokens=Counter()
        if ly['status']=='usable':
            h=hashlib.sha256(text.encode()).hexdigest()
            if h not in languages:languages[h]=langid.classify(text[:10000])[0]
            lang=languages[h]
            tokens=Counter(lyric_tokens(clean_lyric_text(raw)))
            if lang=='en':
                for w,n in tokens.items():lex[w].extend([idx,n])
        qualities.append(dict(song_id=sid,lyrics_status=ly['status'],estimated_primary_language=lang,word_tokens=sum(tokens.values())))
        link='https://en.wikipedia.org/wiki/'+quote(links[sid][0].replace(' ','_')) if len(links[sid])==1 else ''
        track.append([s['title'],s['artist_credit'],singers[sid],ly['status'],lang,sum(tokens.values()),link])
    lang_cache.write_text(json.dumps(languages))
    write('lyric_metrics',qualities[0].keys(),qualities)
    byyear=defaultdict(list);aggregate=[]
    for e in entries:byyear[int(e['year'])].append([int(e['rank']),sidx[e['song_id']],genres[e['entry_id']]])
    for y,rows in sorted(byyear.items()):
        ar={i for _,s,_ in rows for i in track[s][2]}
        aggregate.append(dict(year=y,chart_entries=len(rows),distinct_songs=len({s for _,s,_ in rows}),genre_known=sum(bool(g) for _,_,g in rows),lyrics_usable=sum(track[s][3]=='usable' for _,s,_ in rows),lyrics_instrumental=sum(track[s][3]=='instrumental' for _,s,_ in rows),english_primary_lyrics=sum(track[s][4]=='en' for _,s,_ in rows),distinct_artists=len(ar),artists_origin_known=sum(bool(artists[i]['country_code']) for i in ar),known_origin_countries=len({artists[i]['country_code'] for i in ar if artists[i]['country_code']})))
    write('coverage',aggregate[0].keys(),aggregate)
    geo=geometry()
    payload=dict(years=byyear,songs=track,artists=[[a['name'],a['country_code'],a['origin_type'],a['place'],a['source_url']] for a in artists],words=lex,geo=geo,countries={a['country_code']:countries.get(a['country_code'],a['country_code']) for a in artists if a['country_code']},coverage=aggregate)
    data=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
    packed=base64.b64encode(gzip.compress(data,mtime=0)).decode()
    template=(root/'scripts/explorer.template.html').read_text()
    (root/'explorer.html').write_text(template.replace('DATA_PAYLOAD',packed))
    print('view',len(songs),'songs',len(lex),'search terms',len(packed),'bytes')
if __name__=='__main__': main()
