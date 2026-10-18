import pandas as pd, numpy as np, json, os
raw = pd.read_excel(r'F:\大创项目\shanxi_day.xlsx')
print('raw shape', raw.shape, 'date range', raw['day'].min(), raw['day'].max())
sm = pd.read_csv(r'F:\大创项目\结课版本\03_数据\cases_smooth_2015_2019_daily_wide.csv', parse_dates=['day'])
print('smooth shape', sm.shape, sm['day'].min(), sm['day'].max())
cities = [c for c in sm.columns if c != 'day']
print('cities', cities)
# align
raw['day'] = pd.to_datetime(raw['day'])
m = raw.merge(sm, on='day', suffixes=('_raw','_sm'))
for c in cities:
    if c+'_raw' not in m.columns:
        print('missing col', c); continue
    calc = m[c+'_raw'].rolling(7, min_periods=7).mean()
    diff = np.nanmax(np.abs(calc - m[c+'_sm']))
    print(f'{c}: max|calc-8provided|={diff:.3e}')
# inspect geojson
g = json.load(open(r'F:\大创项目\结课版本\03_数据\shanxi_cities_boundary.json', encoding='utf-8'))
print('geojson type', g['type'], 'features', len(g['features']))
for f in g['features'][:3]:
    print('props', f['properties'])
    print('geom', f['geometry']['type'], 'n coord groups', len(f['geometry']['coordinates']))
# bbox
lons=[]; lats=[]
def walk(coords):
    if isinstance(coords[0], (int,float)):
        lons.append(coords[0]); lats.append(coords[1])
    else:
        for c in coords: walk(c)
for f in g['features']:
    walk(f['geometry']['coordinates'])
print('bbox lon', min(lons), max(lons), 'lat', min(lats), max(lats))
