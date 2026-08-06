from analyze import *
import itertools, sys
d['comm_gross'] = d.comm_long + d.comm_short
d['comm_net_abs'] = -d.comm_net
d['comm_short_oi'] = d.comm_short/d.oi
d['comm_netabs_oi'] = -d.comm_net/d.oi
VARS = {'comm_short':d.comm_short, 'comm_long':d.comm_long, 'comm_net':d.comm_net,
        'comm_net_abs':d.comm_net_abs, 'comm_gross':d.comm_gross,
        'comm_short_%OI':d.comm_short_oi, 'comm_netabs_%OI':d.comm_netabs_oi,
        'noncomm_net':d.nc_net}
DEFS = [('z4',2.0),('z4',1.5),('z1',2.0),('pct13',0.10),('pct13',0.15),('pct26',0.15)]
segs = [(pd.Series(True,index=d.index),'ALL'), (d.date>='2023-01-01','2023+'), (d.date<'2023-01-01','2020-22')]
out=[]
for vn,v in VARS.items():
    for kind,thr in DEFS:
        flag,_ = spike_flags(v, kind, thr)
        for sub,lab in segs:
            r = evaluate(f'{vn}|{kind}>={thr}', flag, sub, lab)
            out.append(r)
res = pd.concat(out, ignore_index=True)
res.to_csv('grid_results.csv', index=False)
def show(seg, h):
    t = res[(res.seg==seg)&(res.h==h)&(res.n>=5)].copy()
    t = t.sort_values('edge', ascending=False)
    cols=['signal','n','ep','mean','med','hit','base_mean','base_hit','edge','p_shift','mae']
    print(f'\n### seg={seg} horizon={h}w')
    print(t[cols].to_string(index=False, float_format=lambda x: f'{x:,.3f}'))
for seg in ['ALL','2023+']:
    for h in [13,26]:
        show(seg,h)
