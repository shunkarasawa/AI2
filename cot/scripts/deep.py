from analyze import *
d['comm_gross']=d.comm_long+d.comm_short
d['comm_short_oi']=d.comm_short/d.oi
d['comm_netabs_oi']=-d.comm_net/d.oi

print('=== 1. contemporaneous relation: is a commercial-short spike just a lagging echo of a rally?')
for vn,v in [('comm_short',d.comm_short),('comm_short_%OI',d.comm_short_oi)]:
    ch4 = v.diff(4)
    for lab,x in [('past 4w return',d.mom4),('past 13w return',d.mom13),('fwd 13w return',d.r13)]:
        c = pd.concat([ch4,x],axis=1).dropna()
        print(f'  corr({vn} 4w-change, {lab}) = {c.corr().iloc[0,1]:+.2f}')

print('\n=== 2. the "naive eyeball" signal: gross commercial short >= +10% vs trailing 13w mean')
flag,val = spike_flags(d.comm_short,'pct13',0.10)
for sub,lab in [(d.date>='2023-01-01','2023+'),(d.date<'2023-01-01','2020-22')]:
    print(evaluate('comm_short|pct13>=10%',flag,sub,lab)[['seg','h','n','ep','mean','hit','base_mean','base_hit','edge','p_shift']].to_string(index=False))

print('\n=== 3. best grid hit: comm_short/OI >= +10% vs trailing 13w mean -- threshold & regime stability')
for thr in (0.05,0.08,0.10,0.12,0.15):
    flag,_ = spike_flags(d.comm_short_oi,'pct13',thr)
    for sub,lab in [(d.date>='2023-01-01','2023+'),(d.date<'2023-01-01','2020-22'),(pd.Series(True,index=d.index),'ALL')]:
        r = evaluate('x',flag,sub,lab)
        r13 = r[r.h==13].iloc[0]
        if r13.get('n',0)>=3:
            print(f'  thr={thr:.2f} {lab:8s} n={r13["n"]:3d} ep={r13["ep"]:2d} mean13={r13["mean"]:+.1%} base={r13["base_mean"]:+.1%} edge={r13["edge"]:+.1%} p={r13["p_shift"]:.3f}')
        else:
            print(f'  thr={thr:.2f} {lab:8s} n<3')

print('\n=== 4. momentum control: signal weeks vs momentum-matched weeks (2023+)')
sub = d.date>='2023-01-01'
for vn,v,thr in [('comm_short',d.comm_short,0.10),('comm_short_%OI',d.comm_short_oi,0.10)]:
    flag,_ = spike_flags(v,'pct13',thr)
    s = d[sub & flag.fillna(False) & d.r13.notna()]
    print(f'  {vn}: signal weeks mean past-4w return = {s.mom4.mean():+.2%} (all weeks {d[sub].mom4.mean():+.2%})')
    # momentum-matched: weeks in same tercile of mom4
    q = d.loc[sub,'mom4'].quantile([1/3,2/3]).values
    tt = pd.cut(d.mom4,[-9,q[0],q[1],9],labels=[0,1,2])
    for t in [0,1,2]:
        m = d[sub & (tt==t) & d.r13.notna()]
        sm = d[sub & (tt==t) & flag.fillna(False) & d.r13.notna()]
        print(f'    mom-tercile {t}: all n={len(m):3d} mean13={m.r13.mean():+.2%} | signal n={len(sm):3d} mean13={sm.r13.mean() if len(sm) else float("nan"):+.2%}')

print('\n=== 5. commercial / non-commercial crossover (the old "grail")')
print('  weeks with comm_net > 0 (commercials net long):', int((d.comm_net>0).sum()))
print('  weeks with comm_net > nc_net:', int((d.comm_net>d.nc_net).sum()))
print('  min |comm_net| by year:')
print(d.assign(y=d.date.dt.year).groupby('y').agg(comm_net_min=('comm_net','max'), comm_net_mean=('comm_net','mean'), nc_net_min=('nc_net','min'), oi=('oi','mean')).round(0).to_string())

print('\n=== 6. what actually happened after every large commercial-short surge (2023+)')
flag,val = spike_flags(d.comm_short,'pct13',0.10)
e = d[(d.date>='2023-01-01') & flag.fillna(False)][['date','px_fri','comm_short','comm_net','r4','r13','r26']]
e['dev%'] = (val[e.index]*100).round(1)
# collapse into episodes
e['gap'] = e.date.diff().dt.days.fillna(999)
e['ep'] = (e.gap>35).cumsum()
print(e.groupby('ep').agg(start=('date','min'), end=('date','max'), n=('date','size'),
        px=('px_fri','first'), comm_short=('comm_short','max'),
        r4=('r4','mean'), r13=('r13','mean'), r26=('r26','mean')).to_string())
