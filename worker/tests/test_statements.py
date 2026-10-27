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
    out = statements.cas_to_rows(data)
    assert out["account"] == "Rohan Mehra"
    kinds = [r["type"] for r in out["rows"]]
    assert kinds == ["buy", "buy", "sell"]  # stamp-duty tax line dropped
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
