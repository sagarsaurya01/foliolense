import type { AssetClass } from "./assetClasses";

// The prototype's sample family. Example data only, not anyone's real holdings.
// price / prev are rupees per unit; for balance types (bank, FD, PPF…) they are the current value.
type Lot = [date: string, qty: number, price: number];
type DemoHolding = { cls: AssetClass; name: string; lots: Lot[]; price: number; prev: number };
type DemoPortfolio = { name: string; type: "individual" | "huf" | "company"; holdings: DemoHolding[] };

const h = (cls: AssetClass, name: string, price: number, prev: number, lots: Lot[]): DemoHolding => ({ cls, name, price, prev, lots });

export const DEMO_FAMILY_NAME = "Mehra Family (demo)";

export const DEMO_PORTFOLIOS: DemoPortfolio[] = [
  {
    name: "Rohan",
    type: "individual",
    holdings: [
      h("EQ", "IDFC First Bank", 72.4, 71.1, [["2023-05-12", 25, 77.8]]),
      h("EQ", "HDFC Life Insurance", 768.2, 760.05, [["2022-08-03", 20, 542.53]]),
      h("EQ", "SBI Cards & Payment", 891.55, 884.0, [["2021-11-18", 12, 980.0], ["2024-03-04", 8, 712.4]]),
      h("EQ", "Nippon India ETF Nifty Bank BeES", 571.3, 566.9, [["2023-01-09", 40, 394.5]]),
      h("EQ", "Sula Vineyards", 318.75, 322.1, [["2026-02-14", 10, 505.0]]),
      h("MFE", "Parag Parikh Flexi Cap - Direct", 92.14, 91.6, [["2022-04-05", 1820.4, 54.93], ["2024-09-10", 640.2, 78.1]]),
      h("MFD", "HDFC Corporate Bond - Direct", 33.81, 33.8, [["2023-06-21", 7420.1, 28.31]]),
      h("BNK", "HDFC Bank Savings ••4410", 245600, 245600, [["2026-04-01", 1, 245600]]),
      h("ULP", "NPS Tier I - SBI Pension", 684300, 681900, [["2020-04-01", 1, 250000], ["2023-04-01", 1, 200000]]),
      h("FD", "SBI FD 7.10% (2027)", 548200, 548090, [["2024-04-15", 1, 500000]]),
      h("PPF", "PPF - SBI", 1284500, 1284500, [["2019-04-01", 1, 150000], ["2020-04-01", 1, 150000], ["2021-04-01", 1, 150000], ["2022-04-01", 1, 150000], ["2023-04-01", 1, 150000], ["2024-04-01", 1, 150000]]),
      h("GLD", "SGB 2.50% 2031 Series II", 12240, 12188, [["2023-09-15", 30, 5923]]),
    ],
  },
  {
    name: "Rohan HUF",
    type: "huf",
    holdings: [
      h("EQ", "Kesoram Industries", 6.2, 6.35, [["2022-10-21", 100, 54.7]]),
      h("EQ", "Ion Exchange India", 548.9, 540.2, [["2023-03-28", 20, 649.71]]),
      h("EQ", "Birla Corporation", 1268.0, 1251.4, [["2021-07-12", 2, 973.0]]),
      h("MFE", "Mirae Asset Large Cap - Direct", 121.47, 120.88, [["2021-02-11", 3105.7, 72.44]]),
      h("CD", "Loan to Kabir Traders @ 9%", 612000, 612000, [["2025-04-01", 1, 550000]]),
    ],
  },
  {
    name: "Meera",
    type: "individual",
    holdings: [
      h("EQ", "Eternal", 287.6, 281.15, [["2023-07-19", 25, 183.0]]),
      h("EQ", "SBI ETF IT", 41.92, 41.3, [["2022-12-02", 200, 32.8]]),
      h("MFE", "UTI Nifty 50 Index - Direct", 176.3, 175.1, [["2020-05-04", 2240.6, 82.2]]),
      h("MFD", "ICICI Pru Liquid - Direct", 395.12, 395.06, [["2026-01-08", 505.9, 384.45]]),
      h("INS", "LIC Jeevan Labh (surrender value)", 318000, 318000, [["2018-03-10", 1, 240000]]),
      h("GLD", "Physical Gold (24K, grams)", 12510, 12460, [["2019-10-20", 40, 3810]]),
    ],
  },
  {
    name: "Kabir Traders Pvt Ltd",
    type: "company",
    holdings: [
      h("EQ", "UFO Moviez India", 88.4, 87.9, [["2022-06-15", 162, 105.55]]),
      h("MFD", "Aditya Birla Arbitrage - Direct", 27.44, 27.43, [["2025-08-01", 36400.2, 26.1]]),
      h("PE", "Unlisted: Neo Agro Foods (shares)", 410, 410, [["2024-11-02", 500, 300]]),
      h("FD", "HDFC Bank FD 7.25% (2026)", 1052300, 1052100, [["2025-12-20", 1, 1000000]]),
    ],
  },
];

export const DEMO_FNO_PORTFOLIO = "Rohan F&O (Zerodha)";
