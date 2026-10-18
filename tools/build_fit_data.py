import pandas as pd, numpy as np, json, os
out_dir = r'F:/大创项目/结课版本/08_可视化网站/data'
base = r'F:/大创项目/新项目/8月21日 气象/output/fit_M5_h12_SYMADJ15'
pred = pd.read_csv(base + '/predictions_test_daily.csv', parse_dates=['day'])
per = pd.read_csv(base + '/metrics_test_per_city_horizon.csv')
summ = pd.read_csv(base + '/metrics_summary.csv').iloc[0]
cities = ['太原市','大同市','阳泉市','长治市','晋城市','朔州市','忻州市','吕梁市','晋中市','临汾市','运城市']
dates = sorted(pred['day'].unique())
print('test days', len(dates), dates[0], dates[-1])
series = {}
for c in cities:
    sub = pred[pred['city']==c].set_index('day').reindex(pd.to_datetime(dates))
    series[c] = {
        'true': [round(float(v),3) if pd.notna(v) else None for v in sub['y_true'].tolist()],
        'pred': [round(float(v),3) if pd.notna(v) else None for v in sub['y_pred_fused'].tolist()],
        'mech': [round(float(v),3) if pd.notna(v) else None for v in sub['y_pred_mech'].tolist()],
    }
prov_true = [0.0]*len(dates); prov_pred = [0.0]*len(dates)
for i in range(len(dates)):
    for c in cities:
        prov_true[i] += (series[c]['true'][i] or 0.0)
        prov_pred[i] += (series[c]['pred'][i] or 0.0)
prov_true=[round(v,2) for v in prov_true]; prov_pred=[round(v,2) for v in prov_pred]
city_metrics = {}
for c in cities:
    sub = per[per['city']==c].sort_values('horizon')
    city_metrics[c] = {
        'rmseH': [round(float(v),4) for v in sub['rmse'].tolist()],
        'maeH': [round(float(v),4) for v in sub['mae'].tolist()],
        'pccH': [round(float(v),4) for v in sub['pcc'].tolist()],
        'allRmse': round(float(sub['rmse'].mean()),4),
        'allMae': round(float(sub['mae'].mean()),4),
        'allPcc': round(float(sub['pcc'].mean()),4),
    }
prov_metrics = {'rmseH': [round(float(summ['H%d_RMSE' % h]),4) for h in range(1,13)],
                'maeH': [round(float(summ['H%d_MAE' % h]),4) for h in range(1,13)],
                'pccH': [round(float(summ['H%d_PCC' % h]),4) for h in range(1,13)],
                'allRmse': round(float(summ['ALL_RMSE']),4), 'allMae': round(float(summ['ALL_MAE']),4),
                'allPcc': round(float(summ['ALL_PCC']),4)}
fit = {
  'testDates': [d.strftime('%Y-%m-%d') for d in dates],
  'series': series,
  'province': {'true': prov_true, 'pred': prov_pred},
  'metrics': {'cities': city_metrics, 'province': prov_metrics},
  'baselines': {'persistence': 2.1225, 'calibratedGlobal': 2.0125, 'calibratedStep': 2.0034,
                'rawModel': 2.1611, 'alpha': 0.25},
  'meta': {'model':'WMEG-Net 15 种子集成', 'testStart':'2018-12-03','testEnd':'2019-12-31',
           'note':'预测为多窗口重叠预测按日平均的集成逐日序列；指标为测试集 132 个(城×步长)单元格等权口径。'}
}
p = os.path.join(out_dir, 'fit_data.json')
json.dump(fit, open(p,'w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
print('fit_data.json', os.path.getsize(p), 'bytes')
print('province RMSE', prov_metrics['allRmse'], 'PCC', prov_metrics['allPcc'])
print('taiyuan allRmse', city_metrics['太原市']['allRmse'], 'PCC', city_metrics['太原市']['allPcc'])
