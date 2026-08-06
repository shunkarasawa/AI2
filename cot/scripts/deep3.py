from analyze import *
import numpy as np
d['comm_short_oi']=d.comm_short/d.oi
sigs={
 'A: comm_short  >= +10% vs 13w mean (raw contracts)': spike_flags(d.comm_short,'pct13',0.10)[0],
 'B: comm_net_short >= +10% vs 13w mean':              spike_flags(-d.comm_net,'pct13',0.10)[0],
 'C: comm_short/OI >= +8% vs 13w mean':                spike_flags(d.comm_short_oi,'pct13',0.08)[0],
}
print('=== strategy sim (long for 13w after each signal, entry at release-Friday close) vs buy&hold')
for name,f in sigs.items():
    for lab,sub in [('2020-2026',d.date>=d.date.min()),('2023-2026',d.date>='2023-01-01')]:
        idx=d.index[(f.fillna(False))&sub]
        inmkt=np.zeros(len(d),bool)
        for i in idx: inmkt[i:min(i+13,len(d))]=True
        w=d.px_fri.pct_change().shift(-1).fillna(0)   # weekly return from week i to i+1
        m=inmkt & sub.values
        strat=float(np.prod(1+w.values[m])-1); weeks=int(m.sum())
        bh=float(d.px_fri[sub].iloc[-1]/d.px_fri[sub].iloc[0]-1); tot=int(sub.sum())
        print(f'  {name[:40]:42s} {lab}: in-market {weeks}/{tot} wks ({weeks/tot:.0%}) | strat {strat:+.1%} | buy&hold {bh:+.1%} | per-week-in-market {(1+strat)**(1/max(weeks,1))-1:+.3%} vs {(1+bh)**(1/tot)-1:+.3%}')

print('\n=== current status (latest COT week 2026-06-30) and the live episode')
n=pd.read_csv('xau_npm.csv',parse_dates=['date']).set_index('date')['usd_per_xau']
last=n.iloc[-1]; print(f'  spot XAU/USD 2026-08-04: {last:,.0f}')
for name,f in sigs.items():
    print(f'  {name[:44]:46s} last 6 weeks: {list(f.fillna(False).iloc[-6:].astype(int))}')
ent=d[d.date.isin(pd.to_datetime(["2026-05-26","2026-06-02","2026-06-09","2026-06-16"]))]
print('  episode 2026-05-26..06-16 entries (Fri close) ->', [round(x) for x in ent.px_fri], f'| now {last:,.0f} => ' ,
      [f'{last/x-1:+.1%}' for x in ent.px_fri])
