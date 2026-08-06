from analyze import *
d['comm_short_oi']=d.comm_short/d.oi
flag,val = spike_flags(d.comm_short_oi,'pct13',0.08)
d['sig']=flag.fillna(False); d['dev']=val

print('=== A. episodes of comm_short/OI >= +8% vs 13w mean (whole sample)')
e=d[d.sig][['date','px_fri','oi','comm_short','comm_short_oi','dev','mom4','r4','r13','r26']].copy()
e['gap']=e.date.diff().dt.days.fillna(999); e['ep']=(e.gap>35).cumsum()
g=e.groupby('ep').agg(start=('date','min'),n=('date','size'),px=('px_fri','first'),
   oi=('oi','mean'),cs=('comm_short','mean'),dev=('dev','max'),
   past4=('mom4','mean'),r4=('r4','mean'),r13=('r13','mean'),r26=('r26','mean'))
print(g.to_string(float_format=lambda x:f'{x:,.3f}'))
print('\nepisode-level (equal weight per episode): mean r13 = %.2f%%  hit %d/%d | base r13 = %.2f%%'
      % (g.r13.mean()*100,(g.r13>0).sum(),g.r13.notna().sum(), d.r13.mean()*100))

print('\n=== B. what drives the %OI spike: OI vs commercial short')
for ep,grp in e.groupby('ep'):
    i0=grp.index[0]
    print(f'  ep{ep} {grp.date.iloc[0].date()}: OI 13w-chg {d.oi[i0]/d.oi[i0-13:i0].mean()-1:+.1%}, comm_short 13w-chg {d.comm_short[i0]/d.comm_short[i0-13:i0].mean()-1:+.1%}')

print('\n=== C. distance from the old crossover signal, by year')
t=d.assign(y=d.date.dt.year)
best=t.loc[t.groupby('y').comm_net.idxmax()][['date','comm_net','nc_net','oi','px_fri']]
best['comm_net_%OI']=(best.comm_net/best.oi*100).round(1)
print('least-short week of each year:'); print(best.to_string(index=False))

print('\n=== D. 2026 so far (COT through 2026-06-30, legacy futures-only through 07-28 separately)')
print(d[d.date>='2026-01-01'][['date','px_fri','oi','comm_long','comm_short','comm_net','nc_net','sig']].to_string(index=False))
