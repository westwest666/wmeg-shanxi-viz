import pandas as pd, numpy as np, json, os, shutil

OUT = r'F:\大创项目\结课版本\08_可视化网站\data'
os.makedirs(OUT, exist_ok=True)

raw = pd.read_excel(r'F:\大创项目\shanxi_day.xlsx', parse_dates=['day']).sort_values('day').reset_index(drop=True)
sm = pd.read_csv(r'F:\大创项目\结课版本\03_数据\cases_smooth_2015_2019_daily_wide.csv', parse_dates=['day']).sort_values('day').reset_index(drop=True)
long = pd.read_csv(r'F:\大创项目\结课版本\03_数据\wmeg_weather_cases_2015_2019_long.csv', parse_dates=['day'])
adj = json.load(open(r'F:\大创项目\结课版本\03_数据\shanxi_adjacency.json', encoding='utf-8'))
geo = json.load(open(r'F:\大创项目\结课版本\03_数据\shanxi_cities_boundary.json', encoding='utf-8'))

cities = ['太原市','大同市','阳泉市','长治市','晋城市','朔州市','忻州市','吕梁市','晋中市','临汾市','运城市']
short = {c: c[:-1] for c in cities}
dates = [d.strftime('%Y-%m-%d') for d in raw['day']]
assert len(dates) == 1826

long_idx = long.set_index(['day','city'])
series = {}
for c in cities:
    s = {}
    s['casesRaw'] = [int(v) for v in raw[c].tolist()]
    s['casesSmooth'] = [round(float(v), 2) if pd.notna(v) else None for v in sm[c].tolist()]
    sub = long[long['city'] == c].set_index('day').reindex(raw['day'])
    def arr(col, nd=2):
        return [round(float(v), nd) if pd.notna(v) else None for v in sub[col].tolist()]
    s['tavg'] = arr('tavg', 1)
    s['rh'] = arr('rh', 1)
    s['AH'] = arr('AH', 2)
    s['precip'] = arr('precip', 1)
    s['tavgAnom'] = arr('tavg_anom', 1)
    s['AHAnom'] = arr('AH_anom', 2)
    s['precipAnom'] = arr('precip_anom', 1)
    s['coldWave'] = [int(v) if pd.notna(v) else 0 for v in sub['cold_wave'].tolist()]
    series[c] = s

# province aggregates
raw_sum = [0]*1826; smooth_sum = [0]*1826; precip_max = [0.0]*1826; tavg_mean=[0.0]*1826
for i in range(1826):
    rs = 0.0; ss = 0.0; pm = 0.0; tm = 0.0
    for c in cities:
        s = series[c]
        rs += s['casesRaw'][i]
        ss += (s['casesSmooth'][i] or 0.0)
        p = s['precip'][i] or 0.0
        if p > pm: pm = p; pmc = c
        tm += s['tavg'][i] or 0.0
    raw_sum[i] = round(rs, 1); smooth_sum[i] = round(ss, 2); precip_max[i] = round(pm, 1); tavg_mean[i] = round(tm/11.0, 2)
province = {'casesRawSum': raw_sum, 'casesSmoothSum': smooth_sum, 'precipMax': precip_max, 'tavgMean': tavg_mean}

# global stats
def flat(key):
    vals = []
    for c in cities:
        vals += [v for v in series[c][key] if v is not None]
    return vals
stats = {}
for key in ['casesRaw','casesSmooth','tavg','rh','AH','precip','tavgAnom','AHAnom','precipAnom']:
    v = np.array(flat(key), dtype=float)
    stats[key] = {'min': float(np.min(v)), 'max': float(np.max(v)), 'q05': float(np.quantile(v,.05)), 'q50': float(np.median(v)), 'q95': float(np.quantile(v,.95)), 'q99': float(np.quantile(v,.99))}

meta = {
    'title': 'WMEG-Net · 山西省流感样病例与气象可视化',
    'dateStart': dates[0], 'dateEnd': dates[-1], 'ndays': len(dates), 'window': 20, 'horizon': 12,
    'split': {'trainEnd': '2018-06-03', 'valStart': '2018-06-04', 'valEnd': '2018-12-02', 'testStart': '2018-12-03'},
    'cities': [{'name': c, 'short': short[c], 'lon': adj['centroid'][short[c]][0], 'lat': adj['centroid'][short[c]][1],
                'neighbors': [n+'市' for n in adj['adj'][short[c]]]} for c in cities],
    'dates': dates, 'stats': stats, 'province': province
}

data = {'meta': meta, 'series': series}
p = os.path.join(OUT, 'app_data.json')
with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',',':'))
print('app_data.json', os.path.getsize(p), 'bytes')
# geo copy (only needed fields)
g = {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':f['properties']['name']},'geometry':f['geometry']} for f in geo['features']]}
gp = os.path.join(OUT, 'geo.json')
with open(gp, 'w', encoding='utf-8') as f:
    json.dump(g, f, ensure_ascii=False, separators=(',',':'))
print('geo.json', os.path.getsize(gp), 'bytes')
print('city degrees:', {c: len(meta['cities'][i]['neighbors']) for i,c in enumerate(cities)})
print('edges:', sum(len(m['neighbors']) for m in meta['cities'])//2)
print('stats precip', stats['precip'])
print('stats tavg', stats['tavg'])
print('stats casesRaw', stats['casesRaw'])
