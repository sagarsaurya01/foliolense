from jobs import statements


def test_cas_transactions_become_buy_sell_rows_with_tieout():
    # casparser's model_dump keeps the enum: "TransactionType.PURCHASE_SIP". The parser must read
    # both that form and a plain "PURCHASE" string (regression: a real CAS dropped every row once).
    data = {
        "investor_info": {"name": "Rohan Mehra"},
        "folios": [{
            "folio": "12345/67",
            "schemes": [{
                "scheme": "Parag Parikh Flexi Cap Direct Growth",
                "isin": "INF879O01027", "amfi": "122639",
                "close": 2460.6,
                "valuation": {"value": 226719.68},
                "transactions": [
                    {"date": "2022-04-05", "type": "PURCHASE", "amount": 100000, "units": 1820.4, "nav": 54.93},
                    {"date": "2024-09-10", "type": "TransactionType.PURCHASE_SIP", "amount": 50000, "units": 640.2, "nav": 78.1},
                    {"date": "2024-09-10", "type": "TransactionType.STAMP_DUTY_TAX", "amount": 2.5, "units": 0, "nav": 0},
                    {"date": "2025-01-10", "type": "REDEMPTION", "amount": -45000, "units": -500, "nav": 90},
                ],
            }],
        }],
    }
    data["folios"][0]["schemes"][0]["type"] = "EQUITY"
    out = statements.cas_to_rows(data)
    assert out["account"] == "Rohan Mehra"
    kinds = [r["type"] for r in out["rows"]]
    assert kinds == ["buy", "buy", "sell"]  # stamp-duty tax line dropped
    assert all(r["cls"] == "MFE" for r in out["rows"])  # equity fund -> Mutual Funds (Equity)
    first = out["rows"][0]
    assert first["isin"] == "INF879O01027"
    assert first["amfi_code"] == "122639"
    assert first["units"] == 1820.4
    assert first["amount_paise"] == 10000000  # ₹1,00,000
    assert first["account_key"] == "12345/67"
    # a sell's amount is positive even though the CAS prints it negative
    assert out["rows"][2]["amount_paise"] == 4500000
    # tie-out compares closing units to units rebuilt from the transactions
    assert out["tieouts"][0]["close_units"] == 2460.6
    assert out["tieouts"][0]["built_units"] == round(1820.4 + 640.2 - 500, 3)
    # importing the same CAS twice must not double up
    assert len({r["source_ref"] for r in out["rows"]}) == 3


def test_cas_identical_transactions_get_distinct_source_refs():
    # a real CAS can list two identical purchases (same fund, date, units, amount); they must not collide
    data = {"folios": [{"folio": "1/1", "schemes": [{
        "scheme": "DSP Index", "isin": "INF740KA1W02", "amfi": "1", "close": 100,
        "transactions": [
            {"date": "2025-10-15", "type": "PURCHASE_SIP", "amount": 9999.5, "units": 977.42, "nav": 10.23},
            {"date": "2025-10-15", "type": "PURCHASE_SIP", "amount": 9999.5, "units": 977.42, "nav": 10.23},
        ],
    }]}]}
    out = statements.cas_to_rows(data)
    assert len(out["rows"]) == 2
    assert len({r["source_ref"] for r in out["rows"]}) == 2  # distinct


def test_ecas_holdings_snapshot():
    data = {"demat_accounts": [{
        "client_id": "1208160012345678",
        "equities": [
            {"isin": "INE040A01034", "symbol": "HDFCBANK", "name": "HDFC Bank", "num_shares": 50, "price": 1642.3, "value": 82115},
            {"isin": "INE999", "symbol": "X", "name": "Zero", "num_shares": 0, "price": 1, "value": 0},
        ],
        "mutual_funds": [{"isin": "INF879O01027", "name": "PPFAS", "num_shares": 100, "nav": 92.14, "value": 9214}],
    }]}
    out = statements.ecas_to_holdings(data)
    assert len(out["holdings"]) == 2  # the zero-share holding is dropped
    hdfc = out["holdings"][0]
    assert hdfc["cls"] == "EQ" and hdfc["qty"] == 50 and hdfc["value_paise"] == 8211500
    assert hdfc["account_key"] == "1208160012345678"
    assert out["holdings"][1]["cls"] == "MFE"


def test_zerodha_tradebook_csv():
    csv_text = (
        "symbol,isin,trade_date,trade_type,quantity,price\n"
        "HDFCBANK,INE040A01034,2024-06-15,buy,50,1580.50\n"
        "IDEA,INE669E01016,2024-07-01,sell,1000,15.20\n"
        "HDFCBANK,INE040A01034,2024-06-15,buy,0,1580.50\n"  # zero qty dropped
    )
    out = statements.tradebook_to_rows(csv_text)
    assert "error" not in out
    assert len(out["rows"]) == 2
    b = out["rows"][0]
    assert b["type"] == "buy" and b["symbol"] == "HDFCBANK" and b["units"] == 50
    assert b["amount_paise"] == 7902500  # 50 * 1580.50
    assert out["rows"][1]["type"] == "sell"
    assert len({r["source_ref"] for r in out["rows"]}) == 2


def test_tradebook_rejects_wrong_file():
    out = statements.tradebook_to_rows("foo,bar\n1,2\n")
    assert out["rows"] == [] and "error" in out


def test_zerodha_contract_note_parse():
    # one settlement page with a buy and a sell summary row
    pages = [
        "Trade Date: 01/04/2026 Settlement No: 2026061\n"
        "ISIN Security Name Quantity WAP Brokerage WAP Total Buy ...\n"
        "INE549H01021 ARSSBL 26 447.1000 0.0000 447.1000 11624.60 0 0.0000 0.0000 0.0000 0.00 26 -11624.60\n"
        "INE397D01024 BHARTIARTL 0 0.0000 0.0000 0.0000 0.00 10 1833.0000 0.0000 1833.0000 18330.00 -10 18330.00\n"
    ]
    out = statements.zerodha_cn_parse(pages)
    assert len(out["rows"]) == 2
    buy = next(r for r in out["rows"] if r["type"] == "buy")
    assert buy["isin"] == "INE549H01021" and buy["symbol"] == "ARSSBL" and buy["units"] == 26
    assert buy["amount_paise"] == 1162460 and buy["cls"] == "EQ"
    sell = next(r for r in out["rows"] if r["type"] == "sell")
    assert sell["symbol"] == "BHARTIARTL" and sell["units"] == 10 and sell["amount_paise"] == 1833000
    # the trade date carries from the page header
    assert all(r["date"] == "2026-04-01" for r in out["rows"])


def test_anand_rathi_cn_multiword_name():
    # Anand Rathi equity note: full security name with spaces, 4-decimal amounts
    pages = [
        "TRADE DATE 28/07/2025 SETTLEMENT DATE. 29/07/2025\n"
        "ISIN Security Name Quantity WAP Brokerage WAP Total BUY ...\n"
        "INE081A01020 TATA STEEL LIMITED (#) 0 0.0000 0.0000 0.0000 0.0000 2 161.9900 4.0500 157.9400 315.8800 -2 315.8800\n"
    ]
    out = statements.broker_cn_parse(pages)
    assert len(out["rows"]) == 1
    r = out["rows"][0]
    assert r["type"] == "sell" and r["isin"] == "INE081A01020"
    assert r["name"] == "TATA STEEL LIMITED (#)" and r["units"] == 2 and r["amount_paise"] == 31588
    assert r["date"] == "2025-07-28"


def test_fno_contract_note_parse():
    pages = [
        "TRADE DATE 01/04/2025 SETTLEMENT DATE. 02/04/2025\n"
        "Order Trade ... Security Buy/Sell Quantity Gross Brok NetRate Close NetTotal Remarks\n"
        "1200000155438849 13:57:47 4037645 13:57:48 OPTIDX NIFTY 24APR25 23900.00 CE SELL 225 79.0000 1.3333 77.6667 80.0500 17475.0000 NSEFO\n"
        "1500000156067010 13:59:00 3221317 13:59:00 OPTIDX NIFTY 24APR25 24400.00 CE BUY 75 23.9500 1.3333 25.2833 24.6500 1896.2500 NSEFO\n"
        "1200000999 10:00:00 123 10:00:01 FUTIDX BANKNIFTY 24APR25 BUY 35 56120.00 2.0 56122.00 56200.00 1964270.00 NSEFO\n"
    ]
    out = statements.fno_cn_parse(pages)
    assert len(out["trades"]) == 3
    opt = out["trades"][0]
    assert opt["underlying"] == "NIFTY" and opt["instrument"] == "CE" and opt["strike_paise"] == 2390000
    assert opt["side"] == "sell" and opt["quantity"] == 225 and opt["price_paise"] == 7767  # net rate
    assert opt["expiry"] == "2025-04-24" and opt["date"] == "2025-04-01" and opt["segment"] == "stock"
    buy = next(t for t in out["trades"] if t["side"] == "buy")
    assert buy["instrument"] == "CE" and buy["quantity"] == 75  # negative net total must not drop the buy
    fut = out["trades"][2]
    assert fut["instrument"] == "FUT" and fut["strike_paise"] is None and fut["underlying"] == "BANKNIFTY"
    assert len({t["source_ref"] for t in out["trades"]}) == 3
