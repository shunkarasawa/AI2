import pandas as pd, numpy as np, datetime as dt

# ---- price: MT4 spot XAUUSD daily (<=2025-06-06) spliced with currency-api XAU/USD (Tue/Fri) ----
x = pd.read_csv('XAU_1d.csv', sep=';')
x['date'] = pd.to_datetime(x['Date'], format='%Y.%m.%d %H:%M').dt.normalize()
mt = x[['date','Close']].rename(columns={'Close':'px'})
n = pd.read_csv('xau_npm.csv'); n['date']=pd.to_datetime(n['date'])
npm = n[['date','usd_per_xau']].rename(columns={'usd_per_xau':'px'})
SPLICE = pd.Timestamp('2025-06-06')
px = pd.concat([mt[mt.date<=SPLICE], npm[npm.date>SPLICE]]).sort_values('date').drop_duplicates('date')
px = px.set_index('date')['px']

def px_on(d, maxback=6):
    """price on date d, else most recent within maxback days"""
    for k in range(maxback+1):
        dd = d - pd.Timedelta(days=k)
        if dd in px.index: return px.loc[dd]
    return np.nan

cot = pd.read_csv('gold_cot_weekly.csv', parse_dates=['date'])
cot['fri'] = cot['date'] + pd.Timedelta(days=3)          # release day (Fri 15:30 ET)
cot['px_tue'] = [px_on(d) for d in cot['date']]
cot['px_fri'] = [px_on(d) for d in cot['fri']]
print('rows', len(cot), 'px_tue NaN', cot.px_tue.isna().sum(), 'px_fri NaN', cot.px_fri.isna().sum())
print('last date with fri price:', cot.dropna(subset=['px_fri']).date.max().date())
cot.to_csv('panel.csv', index=False)
print(cot[['date','px_tue','px_fri','comm_net','comm_short','oi']].tail(4).to_string())
