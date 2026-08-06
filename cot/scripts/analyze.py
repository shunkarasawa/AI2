import pandas as pd, numpy as np
rng = np.random.default_rng(42)
d = pd.read_csv('panel.csv', parse_dates=['date','fri'])
d = d.sort_values('date').reset_index(drop=True)
H = [4,8,13,26]
for h in H:
    d[f'r{h}']  = d.px_fri.shift(-h)/d.px_fri - 1           # tradable: enter at release Friday close
    d[f'rt{h}'] = d.px_tue.shift(-h)/d.px_tue - 1           # report-date basis (has look-ahead)
    d[f'mae{h}']= [ (d.px_fri[i+1:i+h+1].min()/d.px_fri[i]-1) if i+h < len(d) else np.nan for i in range(len(d)) ]
d['mom4']  = d.px_fri/d.px_fri.shift(4)-1
d['mom13'] = d.px_fri/d.px_fri.shift(13)-1

def spike_flags(s, kind, thr, win=52):
    """return boolean series"""
    if kind == 'z4':      # 4-week change, z-scored on trailing 52w of 4w-changes
        ch = s.diff(4); z = (ch - ch.rolling(win).mean())/ch.rolling(win).std()
        return z >= thr, z
    if kind == 'z1':
        ch = s.diff(1); z = (ch - ch.rolling(win).mean())/ch.rolling(win).std()
        return z >= thr, z
    if kind == 'pct13':   # level vs trailing 13w mean (excluding current)
        base = s.shift(1).rolling(13).mean(); v = s/base - 1
        return v >= thr, v
    if kind == 'pct26':
        base = s.shift(1).rolling(26).mean(); v = s/base - 1
        return v >= thr, v
    raise ValueError(kind)

def shift_test(flag, ret, nsim=5000):
    """circular-shift randomization: preserves signal clustering"""
    f = flag.values.astype(bool); r = ret.values
    ok = ~np.isnan(r)
    obs = np.nanmean(r[f & ok])
    n = len(f); cnt = 0; tot = 0
    for _ in range(nsim):
        k = rng.integers(1, n)
        g = np.roll(f, k)
        sel = g & ok
        if sel.sum() == 0: continue
        tot += 1
        if np.nanmean(r[sel]) >= obs: cnt += 1
    return obs, cnt/max(tot,1)

def episodes(flag):
    """count distinct episodes: consecutive/near (<=4w apart) signals merged"""
    idx = np.where(flag.fillna(False).values)[0]
    if len(idx)==0: return 0
    return 1 + int((np.diff(idx) > 4).sum())

def evaluate(name, flag, sub=None, label=''):
    rows=[]
    m = flag.fillna(False)
    if sub is not None: m = m & sub
    for h in H:
        r = d[f'r{h}']
        valid = m & r.notna()
        base = d.loc[(sub if sub is not None else slice(None)), f'r{h}'].dropna() if sub is None else d.loc[sub & r.notna(), f'r{h}']
        if valid.sum()==0:
            rows.append(dict(signal=name, seg=label, h=h, n=0)); continue
        obs, p = shift_test(m, r)
        rows.append(dict(signal=name, seg=label, h=h, n=int(valid.sum()), ep=episodes(m),
                         mean=float(r[valid].mean()), med=float(r[valid].median()),
                         hit=float((r[valid]>0).mean()),
                         base_mean=float(base.mean()), base_hit=float((base>0).mean()),
                         edge=float(r[valid].mean()-base.mean()), p_shift=p,
                         mae=float(d.loc[valid, f'mae{h}'].mean())))
    return pd.DataFrame(rows)

if __name__ == '__main__':
    pd.set_option('display.width', 200)
    print('=== sample:', d.date.min().date(), '->', d.date.max().date(), 'n =', len(d))
    print('gold px: %.0f -> %.0f' % (d.px_fri.iloc[0], d.px_fri.iloc[-1]))
    for seg,lab in [(d.date>='2020-01-01','ALL 2020-2026'), (d.date<'2023-01-01','2020-2022'), (d.date>='2023-01-01','2023-2026')]:
        s = d.loc[seg]
        print(f'{lab}: n={len(s)}  mean r13={s.r13.mean():+.2%} hit={(s.r13>0).mean():.0%}  mean r26={s.r26.mean():+.2%} hit={(s.r26>0).mean():.0%}')
