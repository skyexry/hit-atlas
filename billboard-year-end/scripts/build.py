"""Build Billboard year-end tables. Takes the source cache directory as its argument."""
import copy
import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
import zipfile
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote

import xlrd
from bs4 import BeautifulSoup

cache = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1]
csv.field_size_limit(8_000_000)
PEROT = 'https://doi.org/10.7910/DVN/KRQMKU'
BLAKELY = 'https://www.kaggle.com/datasets/brianblakely/top-100-songs-and-lyrics-from-1959-to-2019'
PAVLIK = 'https://github.com/walkerkq/musiclyrics'
TM = 'https://github.com/tmelo-uea/billboard-hot100-lyrics'

@lru_cache(maxsize=50000)
def norm(s):
    s = s.lower().replace('5th','fifth').replace('ii ','2 ').replace('no. 9','number nine')
    s = unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('&',' and ')
    return ' '.join(re.findall('[a-z0-9]+',s))

@lru_cache(maxsize=50000)
def key(s):
    return norm(s).replace(' ','')

def ident(p,s):
    return p+'_'+hashlib.sha256(s.encode()).hexdigest()[:16]

def tmatch(a,b):
    a,b=key(a),key(b)
    if not a or not b: return False
    return a==b or (min(len(a),len(b))>=5 and (a in b or b in a)) or SequenceMatcher(None,a,b).ratio()>=.85

def amatch(a,b):
    if tmatch(a,b): return True
    stop={'the','and','with','featuring','feat','ft','orchestra','band','of','his','a'}
    left=set(norm(a).split())-stop;right=set(norm(b).split())-stop
    return bool(left and right and (left<=right or right<=left or len(left&right)>=2))

def dump(name,rows,fields=None):
    rows=list(rows)
    with (out/(name+'.csv')).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields or list(rows[0]));w.writeheader();w.writerows(rows)

def wikilink(a):
    href=a.get('href','')
    if '/wiki/' not in href: return ''
    suffix=href.split('/wiki/')[-1]
    return '' if ':' in suffix or '#' in suffix else unquote(suffix).replace('_',' ')

def chart_data():
    chart=[]
    for year in range(1959,2024):
        t=BeautifulSoup((cache/f'{year}.html').read_bytes(),'lxml').select_one('table.wikitable')
        pending={};rows=[]
        for tr in t.select('tr'):
            cells=tr.find_all(['td','th'],recursive=False)
            if not cells: continue
            full=[];j=0
            for col in range(3):
                if col in pending:
                    cell,n=pending.pop(col)
                    if n>1:pending[col]=(cell,n-1)
                elif j<len(cells):
                    cell=cells[j];j+=1
                    count=int(cell.get('rowspan',1))
                    if count>1:pending[col]=(cell,count-1)
                else:break
                full.append(cell)
            if len(full)!=3:continue
            num,title,credit=full
            credit=copy.deepcopy(credit)
            if not num.get_text(strip=True).isdigit():continue
            for sup in title.select('sup')+credit.select('sup'):sup.decompose()
            ct=credit.get_text(' ',strip=True)
            titletext=re.sub(r'^["“]|["”]$','',title.get_text(' ',strip=True)).strip()
            titletext=re.sub(r'["”]\s*/\s*["“]',' / ',titletext)
            parts=[(a.get_text(strip=True),wikilink(a)) for a in title.select('a') if wikilink(a)]
            signed=[]
            for a in credit.select('a[href]'):
                page=wikilink(a)
                if page:
                    signed.append((a.get_text(strip=True),page));a.replace_with(' § ')
            for frag in credit.get_text(' ',strip=True).split('§'):
                name=re.sub(r'^(?:(?:featuring|and|with|or|feat\.?|ft\.?)\b|[,/&()\s])+|(?:\bfeaturing|[,/&()\s])+$','',frag.strip(),flags=re.I).strip()
                if name and name.lower() not in ('friends','the family','dionne and friends','the scotts'):signed.append((name,''))
            rows.append((int(num.get_text(strip=True)),titletext,ct,parts,signed))
        assert len(rows)==(101 if year==1969 else 100),(year,len(rows))
        chart.extend((year,*row) for row in rows)
    return chart

def source_rows():
    with zipfile.ZipFile(cache/'annual-long.zip') as z:
        rows=list(csv.DictReader(io.TextIOWrapper(z.open('all_songs_data.csv'),encoding='utf-8-sig')))
    return rows

def read_perot():
    s=xlrd.open_workbook(cache/'perot.xls').sheet_by_index(0);out=defaultdict(list)
    for i in range(1,s.nrows):
        y,k,title,art,genre=s.row_values(i)[:5]
        try:y=int(y);k=int(k)
        except (TypeError,ValueError):continue
        out[y].append((k,str(title),str(art),str(genre).strip()))
    return out

def matching(rows,rank,title,artist):
    at_rank=[r for r in rows if r[0]==rank and tmatch(r[1],title) and amatch(r[2],artist)]
    if len(at_rank)==1:return at_rank[0]
    candidates=[r for r in rows if tmatch(r[1],title) and amatch(r[2],artist)]
    same=[r for r in candidates if r[0]==rank]
    return same[0] if len(same)==1 else candidates[0] if len(candidates)==1 else None

def genre_labels(s):
    s=s.lower().replace('disco. soul','disco,soul').replace('funk/ soul','funk,soul')
    mapping={'hip hop':'Hip Hop/Rap','rap':'Hip Hop/Rap','dance/electronic':'Dance/Electronic','dance':'Dance/Electronic','electronic':'Dance/Electronic','jazz':'Jazz/Swing','swing':'Jazz/Swing','jazz/swing':'Jazz/Swing','r&b':'R&B'}
    return list(dict.fromkeys(mapping.get(k.strip(),k.strip().title()) for k in s.split(',') if k.strip()))

def lyr_ok(r,title,artist):
    url=r['Song URL'].lower().split('?')[0]
    slug=unquote(url.rsplit('/',1)[-1]);text=r['Lyrics'].strip()
    if not text:return 'missing'
    if re.search(r'(?:reviews?-|genius-(?:translations|romanizations)|-tracklist|-annotated|-by-[^-]+-lyrics$)',url) or not url.endswith('-lyrics') or len(text)>30000:return 'unverified'
    slug=key(slug.removesuffix('-lyrics'))
    title_options=[title,r['Song Title'],re.split(r'\s*\(',title)[0]]
    if not any(key(t) in slug and key(t) for t in title_options):return 'unverified'
    # Require credited artist evidence as well as a matching title in the Genius URL.
    artists=[r['Artist'],artist]+re.split(r'\s+(?:featuring|feat\.?|and|with|&)\s+',artist,flags=re.I)
    if not any(slug.removeprefix('the').startswith(key(re.sub(r'^the ','',s,flags=re.I))) and len(key(s))>=2 for s in artists):return 'unverified'
    return 'matched'

def textstatus(s):
    if not s or not s.strip():return 'missing'
    if re.fullmatch(r'[\W_]*(?:instrumental|instrumental break)[\W_]*',s.strip(),re.I):return 'instrumental'
    if len(re.findall(r'[^\W\d_]+',s))<3:return 'unverified'
    return 'usable'

def supplement():
    extras=defaultdict(list)
    with (cache/'pavlik.csv').open(encoding='cp1252',errors='replace') as f:
        for r in csv.DictReader(f):
            if r['Lyrics'].strip():
                extras[int(r['Year'])].append((int(r['Rank']),r['Song'],r['Artist'],r['Lyrics'],PAVLIK))
    # Split the malformed multi-line CSV on verified ranked row headers (2012/2015).
    field=r'(?:"(?:[^"]|"")*"|[^,"]*)';header=re.compile(r'^(\d{1,3},'+field+','+field+',)(.*)$')
    with zipfile.ZipFile(cache/'lyrics.zip') as z:
        for n in z.namelist():
            m=re.search(r'(\d{4})-lyrics\.csv$',n)
            if not m or int(m[1])>2023:continue
            y=int(m[1]);raw=z.read(n).decode('utf-8-sig');lines=raw.splitlines()
            good={(r['Rank'],r['Musica'],r['Artista']) for r in csv.DictReader(io.StringIO(raw)) if str(r['Rank']).isdigit() and r['Musica'] and r['Artista']}
            heads=[]
            for i,line in enumerate(lines):
                h=header.match(line)
                if not h:continue
                rank,title,artist=next(csv.reader([h[1]]))[:3]
                if (rank,title,artist) in good and 1<=int(rank)<=100:heads.append((i,int(rank),title,artist,h[2]))
            ranks=[v[1] for v in heads];assert ranks==sorted(set(ranks))
            for j,(i,k,t,a,start) in enumerate(heads):
                lyric='\n'.join([start]+lines[i+1:heads[j+1][0] if j+1<len(heads) else len(lines)]).strip().strip('"').strip()
                if lyric:extras[y].insert(0,(k,t,a,lyric,TM))
    return extras

def main():
    chart=chart_data();names,entities,places,countries=json.loads((cache/'origins.json').read_text())
    name_ids=defaultdict(set)
    for _,_,_,_,_,signed in chart:
        for n,page in signed:
            if names.get(page):name_ids[key(n)].add(names[page])
    artists={};songs={};credits={};entries=[];annotations=[]; lyrics={};audit=[];constituents={}
    perot=read_perot();extras=supplement();bl=defaultdict(list)
    for r in source_rows():bl[int(float(r['Year']))].append((int(r['Rank']),r['Song Title'],r['Artist'],r))
    repairs=json.loads((cache/'repairs.json').read_text()) if (cache/'repairs.json').exists() else {}
    extra_art=json.loads((cache/'artist_extra.json').read_text()) if (cache/'artist_extra.json').exists() else {}
    # Checked spelling, abbreviated artist names, alternate titles and double-sided order in the two source rows.
    checked_perot=set('1959-86 1963-7 1967-60 1970-19 1971-72 1973-21 1974-7 1975-40 1977-40 1978-25 1979-25 1979-92 1980-24 1981-11 1981-81 1982-67 1984-61 1989-15 1989-47 1990-40 1990-78 1991-66 1992-25 1993-52 1997-2 1999-47 2000-29 2002-33 2005-35 2007-75 2008-50 2009-87 2010-26 2010-69 2013-71 2014-11 2014-90 2016-82 2020-95'.split())
    # Manually reconciled Perot rows. Use the source rank when the two
    # transcriptions disagree. Preserve source title and credit as published.
    perot_rank_overrides = {
        (1959, 46): 46,  # Bobby Bare recording issued under Bill Parsons
        (1960, 81): 81,  # Robert Mersey recorded under the name Spencer Ross
        (1965, 46): 47,  # Henry VIII title and rank variant
        (1969, 87): 88,  # The Supremes and Temptations, abbreviated credit
        (1972, 99): 100,  # Good Foot, Pt. 1 by James Brown
        (1973, 86): 86,  # Blue Ridge Rangers is John Fogerty
        (1975, 98): 98,  # Source includes the B-side Free Wheelin
        (1983, 92): 92,  # Workbook stores True as Boolean
        (1984, 75): 75,  # K.C. is an abbreviated credit
        (1985, 1): 1,  # George Michael / Wham! release credit
        (1991, 53): 53,  # Source credits DMA for DNA
        (2003, 38): 38,  # Source credits the Casey brothers of Jagged Edge
        (2005, 90): 90,  # Workbook stores True as Boolean
        (2015, 61): 61,  # Workbook stores 7/11 as a spreadsheet date
    }
    for year,rank,title,credit,parts,signed in chart:
        ids=[]
        for name,page in signed:
            q=names.get(page,'')
            if not q and len(name_ids[key(name)])==1:q=next(iter(name_ids[key(name)]))
            entity=entities.get(q,{})
            # Do not substitute a frontman's birthplace for a credited band's formation.
            mismatch='Q5' in entity.get('P31',[]) and re.search(r'\b(?:and (?:the|his)|orchestra|quartet|trio)\b',name,re.I)
            aid=ident('A',page or name) if mismatch or not q else q
            if aid not in artists:
                prop='' if mismatch else 'P19' if entity.get('P19') else 'P740' if entity.get('P740') else ''
                locs=entity.get(prop,[]);pl=places.get(locs[0],{}) if len(locs)==1 else {}
                iso={code for country in pl.get('P17',[]) for code in countries.get(country,{}).get('P297',[])}
                iso.update(pl.get('P297',[]))
                artists[aid]=dict(artist_id=aid,name=name,wiki_title=page,wikidata_id='' if mismatch else q,origin_type={'P19':'birthplace','P740':'formation'}.get(prop,''),place=pl.get('name',''),place_id=locs[0] if len(locs)==1 else '',country_code=next(iter(iso)) if len(iso)==1 else '',source_url=('https://www.wikidata.org/wiki/'+q) if q and not mismatch else '')
                extra=extra_art.get(aid)
                if extra and not artists[aid]['country_code'] and not mismatch and (extra['origin_type']=='birthplace' or (entity.get('P31') and 'Q5' not in entity['P31'])):
                    artists[aid].update(extra);artists[aid]['place_id']=''
            if aid not in ids:ids.append(aid)
        # The ranked recording or a charted double-sided single; retain component links.
        sid=ident('S',key(title)+'|'+','.join(sorted(ids))+'|'+('' if ids else key(credit)))
        songs.setdefault(sid,dict(song_id=sid,title=title,artist_credit=credit))
        for i,aid in enumerate(ids):credits[(sid,aid)]=dict(song_id=sid,artist_id=aid)
        for i,(part,page) in enumerate(parts):constituents[(sid,i)]=dict(song_id=sid,component=i+1,linked_title=part,wiki_title=page)
        eid=f'{year}-{rank:03d}-{sid}'; entries.append(dict(entry_id=eid,year=year,rank=rank,song_id=sid,title=title,artist_credit=credit,chart_source=f'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_{year}'))
        pr=matching(perot[year],rank,title,credit)
        if not pr and f'{year}-{rank}' in checked_perot:
            pr=next(r for r in perot[year] if r[0]==rank)
        if not pr and (year, rank) in perot_rank_overrides:
            source_rank = perot_rank_overrides[year, rank]
            [pr] = [row for row in perot[year] if row[0] == source_rank]
        annotations.append(dict(source_rank=pr[0] if pr else '',source_title=pr[1] if pr else '',source_artist=pr[2] if pr else '',entry_id=eid,song_id=sid,source_genres=pr[3] if pr else '',genres='|'.join(genre_labels(pr[3])) if pr else '',source_url=PEROT if pr else ''))
        rec=matching(bl[year],rank,title,credit);state='missing';txt='';src='';rule='';upstream=''
        compound=len(parts)>1 and ('/' in title or ' / ' in title)
        if rec:
            r=rec[3];upstream=r['Song URL'];state=lyr_ok(r,title,credit)
            if state=='matched':txt=r['Lyrics'];src=upstream;rule='Blakely: title and artist in source URL'
        if compound:state='compound';txt='';src='';rule=''
        if not txt and not compound:
            for source in (TM,PAVLIK):
                ex=matching([v for v in extras[year] if v[4]==source],rank,title,credit)
                if ex and 20<=len(ex[3])<=30000:
                    txt=ex[3];src=ex[4];rule='supplement: chart title and artist';break
        if not txt and not compound and sid in repairs:
            x=repairs[sid];txt=x['lyrics'];src=x['source'];rule='LRCLIB: title, artist and consistent transcript'
        if txt:state=textstatus(txt)
        row=dict(song_id=sid,status=state,source_url=src,match_rule=rule,lyrics=txt if state in ('usable','instrumental') else '')
        if sid not in lyrics or lyrics[sid]['status']!='usable' and state=='usable':lyrics[sid]=row
        if not rec or not pr or (upstream and rec and lyr_ok(rec[3],title,credit)=='unverified'):
            audit.append(dict(entry_id=eid,lyric_row_matched=bool(rec),original_lyric_url=upstream,original_lyric_check=lyr_ok(rec[3],title,credit) if rec else 'unmatched',genre_row_matched=bool(pr)))
    dump('chart_entries',entries);dump('songs',songs.values());dump('song_artists',credits.values());dump('artists',artists.values())
    dump('genres',annotations);dump('lyrics',lyrics.values());dump('song_links',constituents.values());dump('source_review',audit)
    print(len(entries),'entries',len(songs),'songs',len(artists),'artists',Counter(r['status'] for r in lyrics.values()),'genre rows',sum(bool(r['genres']) for r in annotations),'origin artists',sum(bool(r['country_code']) for r in artists.values()),flush=True)
if __name__=='__main__':main()
