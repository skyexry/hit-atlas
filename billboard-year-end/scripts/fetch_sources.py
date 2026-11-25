from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests,time
import sys
p=Path(sys.argv[1]);p.mkdir(exist_ok=True,parents=True)
headers={'User-Agent':'HitAtlasResearch/1.0 (academic charts project; https://github.com/skyexry/hit-atlas)'}
def get(v):
 name,url=v
 for i in range(3):
  try:
   path=p/name
   if path.exists():return
   r=requests.get(url,headers=headers,timeout=30);r.raise_for_status();path.write_bytes(r.content);return
  except Exception as e:err=str(e);time.sleep(1)
 raise RuntimeError(name+' '+err)
urls=[('perot.xls','https://dataverse.harvard.edu/api/access/datafile/10886587'),('world.geojson','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')]
urls += [('annual-long.zip','https://www.kaggle.com/api/v1/datasets/download/brianblakely/top-100-songs-and-lyrics-from-1959-to-2019'),
         ('lyrics.zip','https://codeload.github.com/tmelo-uea/billboard-hot100-lyrics/zip/refs/heads/main'),
         ('pavlik.csv','https://raw.githubusercontent.com/walkerkq/musiclyrics/master/billboard_lyrics_1964-2015.csv'),
         ('world50.geojson','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson')]
urls += [(str(y)+'.html',f'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_{y}') for y in range(1959,2024)]
with ThreadPoolExecutor(5) as pool:list(pool.map(get,urls))
