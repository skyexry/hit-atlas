from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import requests,json,time,hashlib
import sys
cache=Path(sys.argv[1])
def collect():
 titles=set()
 for f in cache.glob('*.html'):
  soup=BeautifulSoup(f.read_bytes(),'lxml')
  for row in soup.select_one('table.wikitable').select('tr'):
   cells=row.find_all(['td','th'],recursive=False)
   if len(cells)==3 and cells[0].get_text(strip=True).isdigit():
    for a in cells[2].select('a[href]'):
     href=a['href']
     if '/wiki/' in href and '#' not in href and ':' not in href.split('/wiki/')[-1]:titles.add(unquote(href.split('/wiki/')[-1]).replace('_',' '))
 return sorted(titles)
headers={'User-Agent':'HitAtlasResearch/1.0 (https://github.com/skyexry/hit-atlas; educational data project)'}
def fetch(stage,items,worker,size=35):
 out={}
 def part(chunk):
  path=cache/(stage+'-'+hashlib.sha256(json.dumps(chunk).encode()).hexdigest()[:14]+'.json')
  if path.exists():return json.loads(path.read_text())
  for t in range(3):
   try:
    v=worker(chunk);path.write_text(json.dumps(v,ensure_ascii=False));return v
   except Exception as e:err=str(e);time.sleep(1+t)
  print(stage,'error',err[:180],flush=True);return {}
 with ThreadPoolExecutor(4) as pool:
  for result in pool.map(part,[items[i:i+size] for i in range(0,len(items),size)]):out.update(result)
 print(stage,len(out),flush=True)
 return out
def api(host,params):
 r=requests.get('https://'+host+'/w/api.php',params={'format':'json','formatversion':2,**params},headers=headers,timeout=28);r.raise_for_status();d=r.json()
 if 'error'in d:raise ValueError(d['error'])
 return d
def pages(titles):
 q=api('en.wikipedia.org',{'action':'query','prop':'pageprops','ppprop':'wikibase_item','redirects':1,'titles':'|'.join(titles)})['query']
 red={r['from']:r['to'] for r in q.get('normalized',[])+q.get('redirects',[])}
 m={p['title']:p.get('pageprops',{}).get('wikibase_item','') for p in q['pages']}
 def resolve(t):
  for _ in range(5):t=red.get(t,t)
  return m.get(t,'')
 return {t:resolve(t) for t in titles}
def entities(ids):
 d=api('www.wikidata.org',{'action':'wbgetentities','ids':'|'.join(ids),'props':'claims|labels','languages':'en'})['entities'];ret={}
 for id,e in d.items():
  r={'name':e.get('labels',{}).get('en',{}).get('value','')}
  for prop in ['P19','P740','P17','P297','P31','P131','P495','P136']:
   vs=[]
   for c in e.get('claims',{}).get(prop,[]):
    if c.get('rank')=='deprecated':continue
    v=c['mainsnak'].get('datavalue',{}).get('value')
    if isinstance(v,dict):v=v.get('id')
    if v and v not in vs:vs.append(v)
   r[prop]=vs
  ret[id]=r
 return ret
if __name__=='__main__':
 titles=collect()
 names=fetch('titles',titles,pages)
 artists=fetch('entities',sorted(set(names.values())-{''}),entities,32)
 places=fetch('places',sorted({v for a in artists.values() for k in ['P19','P740'] for v in a[k]}),entities,40)
 countries=fetch('countries',sorted({v for p in places.values() for v in p['P17']}|{v for a in artists.values() for v in a['P495']}),entities,40)
 (cache/'origins.json').write_text(json.dumps([names,artists,places,countries],ensure_ascii=False))
