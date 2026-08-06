import pandas as pd, glob
rows=[]
for f in sorted(glob.glob('cot/c_year_*.xlsx')):
    df = pd.read_excel(f)
    g = df[df['Market_and_Exchange_Names'].astype(str).str.strip()=='GOLD - COMMODITY EXCHANGE INC.'].copy()
    print(f, g.shape, g['Report_Date_as_MM_DD_YYYY'].min(), g['Report_Date_as_MM_DD_YYYY'].max())
    rows.append(g)
d = pd.concat(rows, ignore_index=True)
d['date']=pd.to_datetime(d['Report_Date_as_MM_DD_YYYY'])
cols = {
 'oi':'Open_Interest_All',
 'pm_l':'Prod_Merc_Positions_Long_ALL','pm_s':'Prod_Merc_Positions_Short_ALL',
 'sw_l':'Swap_Positions_Long_All','sw_s':'Swap__Positions_Short_All','sw_sp':'Swap__Positions_Spread_All',
 'mm_l':'M_Money_Positions_Long_ALL','mm_s':'M_Money_Positions_Short_ALL','mm_sp':'M_Money_Positions_Spread_ALL',
 'or_l':'Other_Rept_Positions_Long_ALL','or_s':'Other_Rept_Positions_Short_ALL','or_sp':'Other_Rept_Positions_Spread_ALL',
 'nr_l':'NonRept_Positions_Long_All','nr_s':'NonRept_Positions_Short_All',
}
out = pd.DataFrame({'date':d['date']})
for k,v in cols.items(): out[k]=pd.to_numeric(d[v], errors='coerce')
out=out.sort_values('date').drop_duplicates('date').reset_index(drop=True)
# legacy-equivalent mapping
out['comm_long']  = out.pm_l + out.sw_l + out.sw_sp
out['comm_short'] = out.pm_s + out.sw_s + out.sw_sp
out['comm_net']   = (out.pm_l + out.sw_l) - (out.pm_s + out.sw_s)
out['nc_long']    = out.mm_l + out.or_l
out['nc_short']   = out.mm_s + out.or_s
out['nc_spread']  = out.mm_sp + out.or_sp
out['nc_net']     = out.nc_long - out.nc_short
out['nonrept_net']= out.nr_l - out.nr_s
# identity check: OI = comm_long + nc_long + nc_spread + nonrept_long
chk = out.comm_long + out.nc_long + out.nc_spread + out.nr_l - out.oi
print('OI identity max abs err:', chk.abs().max())
print(out.shape, out.date.min(), out.date.max())
out.to_csv('gold_cot_weekly.csv', index=False)
print(out.tail(3)[['date','oi','comm_net','nc_net','comm_short','comm_long']].to_string())
