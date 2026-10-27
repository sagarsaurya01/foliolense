from jobs import sources

AMFI = """Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date

Open Ended Schemes(Equity)

135762;INF846K01WO1;-;Axis Children's Fund;Direct Plan;Growth Option;28.7924;26-Oct-2026
120503;INF209K01VT4;INF209K01VU2;Aditya Birla Sun Life;Direct;Growth;512.33;26-Oct-2026
999;;-;Bad row no isin;Direct;Growth;10;26-Oct-2026
"""

EQL = """SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
HDFCBANK,HDFC Bank Limited,EQ,08-NOV-1995,1,1,INE040A01034,1
RELIANCE,Reliance Industries Limited,EQ,29-NOV-1995,10,1,INE002A01018,10
"""

BHAV = """SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE
HDFCBANK, EQ, 26-Oct-2026, 1600.00, 1610, 1650, 1595, 1640, 1642.30, 1630
RELIANCE, EQ, 26-Oct-2026, 2900.00, 2910, 2950, 2890, 2945, 2948.50, 2930
SOMEFUT, FUTSTK, 26-Oct-2026, 100, 100, 100, 100, 100, 100, 100
UNKNOWN, EQ, 26-Oct-2026, 50, 50, 50, 50, 50, 50, 50
"""

IDX = """Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%)
Nifty 50,26-10-2026,22524.4,22753.2,22387.35,22753.2,153.2,.68
Nifty Bank,26-10-2026,54250.3,54392.5,53777.5,54366.7,79.35,.15
Nifty IT,26-10-2026,1,1,1,1,1,1
"""


def test_amfi_parses_isin_nav_date():
    rows = sources.parse_amfi(AMFI)
    assert len(rows) == 3  # growth + reinvestment isins, skips the no-isin row
    hdfc = next(r for r in rows if r.isin == "INF846K01WO1")
    assert hdfc.kind == "MF"
    assert hdfc.close_paise == 2879  # ₹28.7924 -> paise (NAV kept to 2dp, as elsewhere)
    assert hdfc.price_date == "2026-10-26"
    assert hdfc.amfi_code == "135762"


def test_nse_matches_symbol_to_isin_and_keeps_eq_only():
    master = sources.parse_equity_master(EQL)
    assert master["HDFCBANK"][0] == "INE040A01034"
    rows = sources.parse_nse_bhav(BHAV, master)
    assert {r.nse_symbol for r in rows} == {"HDFCBANK", "RELIANCE"}  # FUTSTK dropped, UNKNOWN unmatched
    hdfc = next(r for r in rows if r.nse_symbol == "HDFCBANK")
    assert hdfc.isin == "INE040A01034"
    assert hdfc.close_paise == 164230
    assert hdfc.prev_close_paise == 160000
    assert hdfc.kind == "EQ"


def test_indices_filtered_and_prev_close_from_change():
    idx = sources.parse_indices(IDX, {"Nifty 50", "Nifty Bank"})
    assert {i.code for i in idx} == {"Nifty 50", "Nifty Bank"}
    n = next(i for i in idx if i.code == "Nifty 50")
    assert n.close == 22753.2
    assert round(n.prev_close, 2) == round(22753.2 - 153.2, 2)
    assert n.price_date == "2026-10-26"
