import csv,json,re,time,unicodedata,requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
from bs4 import BeautifulSoup
from babel import Locale
import sys
p=Path(sys.argv[1]); out=Path(__file__).resolve().parents[1]
read=lambda f:list(csv.DictReader((out/(f+'.csv')).open(encoding='utf-8-sig')))
headers={'User-Agent':'HitAtlasResearch/1.0 (https://github.com/skyexry/hit-atlas)'}
def get(url,params=None):
 for i in range(2):
  try:
   r=requests.get(url,params=params,headers=headers,timeout=16);r.raise_for_status();return r
  except requests.RequestException:time.sleep(0.5)
def norm(s):
 return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
lc=Locale.parse('en').territories;mapping={norm(v):k for k,v in lc.items() if len(k)==2}
mapping.update({norm(v):k for k,vs in {'US':['US','U.S.','U.S.A.','USA','United States of America'],'GB':['UK','U.K.','England','Scotland','Wales','Northern Ireland'],'BS':['The Bahamas'],'TT':['Trinidad and Tobago']}.items() for v in vs})
def artist(a):
 if not a['wiki_title']:return
 path=p/'origin_extra'/a['artist_id'];url='https://en.wikipedia.org/wiki/'+quote(a['wiki_title'].replace(' ','_'))
 if path.exists():return
 resp=get(url)
 if resp is None:return
 table=BeautifulSoup(resp.content,'lxml').select_one('table.infobox')
 result={}
 if table:
  for tr in table.select('tr'):
   h=tr.find('th',recursive=False);v=tr.find('td',recursive=False)
   if not h or not v:continue
   typ=h.get_text(' ',strip=True)
   if typ not in ('Born','Origin'):continue
   if typ=='Born':
    place=v.select_one('.birthplace')
    if place:v=place
    else:continue
   for tag in v.select('sup'):tag.decompose()
   s=v.get_text(' ',strip=True);segments=[norm(t) for t in re.split(r',|;|\n',s)]
   code=next((mapping[k] for k in reversed(segments) if k in mapping),'')
   if code and (typ=='Born' or not result):
    result=dict(origin_type='birthplace' if typ=='Born' else 'artist_origin',place=s,country_code=code,source_url=url)
    if typ=='Born':break
 path.write_text(json.dumps(result))
def titlekey(s):return norm(re.split(r'\s+\((?:feat|with|ft)\b',s,flags=re.I)[0])
def lookup(s):
 path=p/'repair_extra'/s['song_id']
 if path.exists():return
 a=s['artist_credit'];main=re.split(r'\s+(?:featuring|feat\.?|with)\s+',a,flags=re.I)[0]
 resp=get('https://lrclib.net/api/search',{'track_name':s['title'],'artist_name':main})
 if resp is None:return
 cand=[r for r in resp.json() if titlekey(r['trackName'])==titlekey(s['title']) and norm(r['artistName']) in {norm(a),norm(main)}]
 variants={re.sub(r'\W+','',r['plainLyrics'] or '').lower() for r in cand if r['plainLyrics']}
 valid=[r for r in cand if r['plainLyrics'] and len(variants)==1 or r['instrumental'] and not variants]
 result={}
 if valid:
  r=valid[0];result={'lyrics':r['plainLyrics'] or '[Instrumental]','source':'https://lrclib.net/api/get/'+str(r['id'])}
 path.write_text(json.dumps(result))
for d in ('origin_extra','repair_extra'):(p/d).mkdir(exist_ok=True)
def runner(kind,fn,rows,outfile):
 with ThreadPoolExecutor(6) as pool:list(pool.map(fn,rows))
 d={f.name:json.loads(f.read_text()) for f in (p/kind).iterdir()};d={k:v for k,v in d.items() if v}
 (p/outfile).write_text(json.dumps(d,ensure_ascii=False));print(outfile,len(d),flush=True)
if __name__=='__main__':
 ids={r['song_id'] for r in read('lyrics') if r['status'] in ('missing','unverified')}
 with ThreadPoolExecutor(2) as pool:
  futures=[pool.submit(runner,'origin_extra',artist,[r for r in read('artists') if not r['country_code']],'artist_extra.json'),pool.submit(runner,'repair_extra',lookup,[s for s in read('songs') if s['song_id'] in ids],'repairs.json')]
  for f in futures:f.result()
