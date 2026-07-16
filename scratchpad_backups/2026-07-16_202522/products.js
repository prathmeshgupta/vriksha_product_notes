// Discretionary & Systematic Portfolio Product Notes — Data Model
// Market: India | Platform: smallcase (SEBI Research Analyst model-portfolio framework)
// Generated: July 2026. Instrument references are illustrative of the current investable
// universe based on public data as of mid-2026 and must be reconfirmed at rebalance/launch.

const PRODUCTS = [
{
  id: "P1",
  code: "DSOP",
  name: "Complete Discretionary Stock-Only Portfolio",
  shortName: "Discretionary Equity (GARP + Value + Special Situations)",
  category: "Discretionary — Single Asset Class (Equity)",
  assetClasses: ["Indian Equities (direct stocks)"],
  objective: "To generate long-term capital appreciation ahead of the broad market by discretionarily blending three complementary equity styles — Growth at a Reasonable Price (GARP), Value, and Special Situations — within a single concentrated stock portfolio, with the fund manager retaining full discretion over stock selection, weights, and style tilt through the cycle.",
  philosophy: "Pure styles are cyclical: value outperforms growth for years and then reverses; special situations are episodic and lumpy. A discretionary manager who can shift emphasis across GARP, Value, and Special Situations as the cycle turns should produce a smoother, more consistent return stream than any single style sleeve run in isolation. This product is unconstrained by a fixed sub-allocation formula — sleeve weights are a house call, reviewed at least quarterly, and disclosed after the fact.",
  styleSleeves: [
    {
      name: "GARP (Growth at a Reasonable Price)",
      weightRange: "35–55%",
      criteria: "Earnings CAGR (3-yr fwd estimate) > 15%; PEG ratio < 1.5; ROE > 15%; consistent EPS upgrades over trailing 2 quarters; net debt/EBITDA < 2x.",
      universe: "Nifty 500 constituents, large- and mid-cap bias",
      indicativeNames: "Titan Company, Divi's Laboratories, Trent, Polycab India, Cholamandalam Investment & Finance"
    },
    {
      name: "Value",
      weightRange: "25–40%",
      criteria: "P/E and P/B below 5-year sector median; EV/EBITDA discount to peer set; dividend yield > sector average; free cash flow positive for 3 consecutive years.",
      universe: "Nifty 500, cross-cap, benchmarked loosely against Nifty500 Value 50 construction logic (E/P, B/P, S/P, dividend yield composite)",
      indicativeNames: "Coal India, NTPC, ONGC, select PSU banks, Bharat Petroleum"
    },
    {
      name: "Special Situations",
      weightRange: "15–25%",
      criteria: "Demerger/spin-off arbitrage, corporate restructuring, regulatory-driven re-rating, promoter/PE stake unlocks, turnaround post-stress (asset quality or leverage normalization), open offers/delisting-adjacent situations.",
      universe: "Cross-cap, event-driven, idiosyncratic — not benchmark-anchored",
      indicativeNames: "Post-demerger listings, PSU disinvestment candidates, companies exiting IBC/restructuring with visible earnings normalization (illustrative category, not standing recommendations)"
    }
  ],
  portfolioConstructionRules: { stockCountRange: "15-25", singleStockCap: "10%", sectorCap: "30% (25% BFSI)", cashBuffer: "0-5%" },
  portfolioConstruction: "15–25 stocks. Single-stock cap 10% at initiation, sector cap 30% (25% for BFSI). No derivatives, no leverage, no short positions — long-only, fully invested with cash held only for liquidity/redemption buffer (typically 0–5%).",
  benchmark: "Nifty 500 TRI (primary); Nifty500 Multicap 50:25:25 TRI (secondary, for cap-mix comparison)",
  rebalanceFrequency: "Discretionary review monthly; formal sleeve-weight and constituent rebalance quarterly, or ad hoc on trigger events (earnings shock, corporate action, stop-loss breach at −20% from entry on a single name).",
  riskProfile: "High",
  suitability: "Investors with a 5+ year horizon, high risk tolerance, and comfort with concentrated, benchmark-agnostic equity exposure. Not suitable for capital-protection mandates or horizons under 3 years.",
  minInvestment: "As per smallcase platform minimum (typically ₹15,000–₹50,000 depending on constituent prices); this is a model-portfolio subscription, not a SEBI-registered PMS mandate (PMS carries a ₹50 lakh regulatory minimum under SEBI (Portfolio Managers) Regulations, 2020 — not applicable here).",
  fees: "Subscription/performance fee as configured on the smallcase platform (to be finalized before launch) — placeholder: e.g., flat annual subscription fee, no entry load, exit load nil after platform's standard holding period.",
  taxNote: "Tax implications (STCG/LTCG on direct equity, no pass-through wrapper) to be detailed in a future revision. Not covered in this version of the note.",
  keyRisks: [
    "Concentration risk from 15–25 stock construction",
    "Style-timing risk — discretionary sleeve reallocation can lag or mistime cycle turns",
    "Special-situations sleeve carries event risk (deal breaks, delayed corporate actions)",
    "No downside hedge — fully long-only equity exposure",
    "Liquidity risk in mid/small-cap names during stress"
  ]
},
{
  id: "P2",
  code: "DMAP",
  name: "Complete Discretionary Multi-Asset Portfolio",
  shortName: "Discretionary Multi-Asset (Equity + REITs + InvITs + ETFs)",
  category: "Discretionary — Multi Asset Class",
  assetClasses: ["Indian Equities (direct stocks)", "REITs", "InvITs", "Sectoral ETFs", "Index ETFs", "Factor ETFs", "Commodity ETFs", "Debt/Cash ETFs"],
  objective: "To deliver risk-adjusted total return by combining the stock-only GARP+Value+Special Situations sleeve (Product 1) with listed real-asset yield instruments (REITs, InvITs) and a full ETF toolkit (index, sectoral, factor, commodity, debt/cash) under a single discretionarily-managed, all-weather mandate.",
  philosophy: "This is the flagship 'one portfolio does everything' product: it retains the alpha-seeking equity engine from Product 1 but wraps it with diversifiers that behave differently across the cycle — REITs and InvITs for bond-like income with equity-like inflation participation, factor and sectoral ETFs for tactical tilts without single-stock risk, commodity ETFs (principally gold) as a portfolio hedge, and debt/cash ETFs as the ballast. Allocation across the eight sleeves is fully discretionary and reviewed at least monthly against a macro/valuation dashboard (rates direction, equity valuation percentile, credit spreads, gold momentum).",
  strategicAllocationRanges: [
    { sleeve: "Direct Equities (GARP+Value+Special Situations, per Product 1)", range: "35–55%" },
    { sleeve: "Index ETFs (Nifty 50 / Next 50 / Midcap 150)", range: "5–15%" },
    { sleeve: "Sectoral ETFs (tactical)", range: "0–10%" },
    { sleeve: "Factor ETFs (Momentum/Alpha/Quality/Low-Vol)", range: "5–15%" },
    { sleeve: "REITs (Embassy, Mindspace, Brookfield India, Nexus Select, Knowledge Realty)", range: "5–12%" },
    { sleeve: "InvITs (IndiGrid, PowerGrid InvIT, IRB InvIT, National Highways Infra Trust)", range: "5–12%" },
    { sleeve: "Commodity ETFs (Gold BeES, Silver BeES)", range: "3–10%" },
    { sleeve: "Debt/Cash ETFs (Liquid ETF, Bharat Bond ETF, G-Sec ETF)", range: "5–15%" }
  ],
  indicativeInstruments: {
    reits: "Embassy Office Parks REIT, Mindspace Business Parks REIT, Brookfield India Real Estate Trust, Nexus Select Trust, Knowledge Realty Trust",
    invits: "IndiGrid Infrastructure Trust, PowerGrid Infrastructure Investment Trust, IRB InvIT Fund, National Highways Infra Trust",
    indexETFs: "Nippon India ETF Nifty 50 BeES, Nippon India ETF Nifty Next 50 Junior BeES, Nippon India ETF Nifty Midcap 150",
    sectoralETFs: "Nippon India ETF Nifty Bank BeES, Nippon India ETF Nifty IT, Nippon India ETF Nifty Pharma, Nippon India ETF Nifty India Consumption (FMCG-oriented)",
    factorETFs: "Nippon India ETF Nifty Alpha Low Volatility 30, ICICI Prudential Nifty Alpha Low-Volatility 30 ETF, Nifty 200 Momentum 30-linked ETFs, Nifty500 Value 50-linked ETFs",
    commodityETFs: "Nippon India ETF Gold BeES, Nippon India ETF Silver BeES, HDFC Silver ETF",
    debtCashETFs: "Bharat Bond ETF (target-maturity series), Nippon India ETF Nifty 1D Rate Liquid BeES, LIC MF Nifty 8-13yr G-Sec ETF"
  },
  benchmark: "Custom blended benchmark: 55% Nifty 500 TRI + 15% Nifty REITs & InvITs Index + 15% Nifty 50 Arbitrage/Gold composite + 15% CRISIL Composite Bond Index (weights indicative, to be fixed at launch and disclosed in factsheet).",
  rebalanceFrequency: "Sleeve-level allocation reviewed monthly; full rebalance to target bands quarterly; hedge/gold sleeve can be adjusted ad hoc on volatility triggers (India VIX > 20).",
  riskProfile: "Moderate-High (lower than Product 1 due to REIT/InvIT/debt ballast)",
  suitability: "Investors wanting a single all-in-one discretionary product spanning growth, income, and inflation-hedge sleeves, 4+ year horizon, comfortable with equity-linked drawdowns of 15–25% in stress scenarios.",
  minInvestment: "As per smallcase platform minimum; not a SEBI PMS mandate.",
  fees: "To be finalized before launch — placeholder subscription-fee structure per smallcase convention.",
  taxNote: "Multi-instrument tax treatment (equity STCG/LTCG, REIT/InvIT distribution taxability split between interest/dividend/capital-return components, ETF capital gains) to be detailed in a future revision.",
  keyRisks: [
    "REIT/InvIT distributions are not guaranteed and are sensitive to occupancy, toll traffic, and regulated tariff resets",
    "Interest-rate sensitivity in InvIT and debt ETF sleeves",
    "Multi-instrument complexity increases tracking and rebalancing friction/costs",
    "Sectoral and factor ETF tilts add cyclicality risk if mistimed",
    "Gold/silver sleeve can drag returns in strong equity bull phases"
  ]
},
{
  id: "P3",
  code: "DMAERI-RB",
  name: "Discretionary Multi-Asset ETF/REIT/InvIT Portfolio — Risk-Profiled (Aggressive/Moderate/Conservative)",
  shortName: "Discretionary Multi-Asset ETF/REIT/InvIT — by Risk Profile",
  category: "Discretionary — Multi Asset, ETF/REIT/InvIT only (no direct stocks)",
  assetClasses: ["Index ETFs", "Sectoral ETFs", "Factor ETFs", "Commodity ETFs", "Debt/Cash ETFs", "REITs", "InvITs"],
  objective: "To offer a fully liquid, exchange-traded, no-direct-stock multi-asset portfolio built entirely from ETFs, REITs, and InvITs, discretionarily allocated across three risk bands so investors can select the variant matching their risk capacity without needing a bespoke stock-picking mandate.",
  philosophy: "Every constituent here trades on-exchange with T+1 settlement and daily NAV/price discovery — this product exists for investors who want multi-asset diversification with maximum liquidity and minimum single-security risk (no direct equities). The three variants differ only in strategic weight bands between growth (equity ETFs/factor ETFs), income/real-asset (REITs/InvITs), and defensive (debt/cash/gold) sleeves; the instrument universe is shared.",
  variants: [
    {
      profile: "Aggressive",
      targetInvestor: "10+ year horizon, high risk tolerance, prioritizes growth over income stability.",
      allocation: [
        { sleeve: "Index ETFs (broad + midcap)", range: "30–40%" },
        { sleeve: "Factor ETFs (Momentum/Alpha)", range: "15–20%" },
        { sleeve: "Sectoral ETFs (tactical)", range: "5–10%" },
        { sleeve: "REITs", range: "8–12%" },
        { sleeve: "InvITs", range: "8–12%" },
        { sleeve: "Commodity ETFs (Gold/Silver)", range: "3–7%" },
        { sleeve: "Debt/Cash ETFs", range: "5–10%" }
      ],
      expectedEquityLikeExposure: "~75–85%"
    },
    {
      profile: "Moderate",
      targetInvestor: "5–10 year horizon, balanced risk tolerance, wants growth with meaningful income ballast.",
      allocation: [
        { sleeve: "Index ETFs (broad + midcap)", range: "20–28%" },
        { sleeve: "Factor ETFs (Quality/Low-Vol tilt)", range: "10–15%" },
        { sleeve: "Sectoral ETFs (tactical)", range: "0–8%" },
        { sleeve: "REITs", range: "10–15%" },
        { sleeve: "InvITs", range: "10–15%" },
        { sleeve: "Commodity ETFs (Gold/Silver)", range: "5–10%" },
        { sleeve: "Debt/Cash ETFs", range: "15–25%" }
      ],
      expectedEquityLikeExposure: "~50–60%"
    },
    {
      profile: "Conservative",
      targetInvestor: "3–5 year horizon, low risk tolerance, prioritizes capital stability and income over growth.",
      allocation: [
        { sleeve: "Index ETFs (broad, large-cap only)", range: "8–15%" },
        { sleeve: "Factor ETFs (Low-Vol only)", range: "5–8%" },
        { sleeve: "Sectoral ETFs (tactical)", range: "0%" },
        { sleeve: "REITs", range: "8–12%" },
        { sleeve: "InvITs", range: "8–12%" },
        { sleeve: "Commodity ETFs (Gold only, inflation hedge)", range: "5–10%" },
        { sleeve: "Debt/Cash ETFs", range: "40–55%" }
      ],
      expectedEquityLikeExposure: "~20–30%"
    }
  ],
  sharedInstrumentUniverse: {
    indexETFs: "Nippon India ETF Nifty 50 BeES, Nippon India ETF Nifty Next 50 Junior BeES, Nippon India ETF Nifty Midcap 150, Mirae Asset Nifty Midcap 150 ETF",
    sectoralETFs: "Nifty Bank, Nifty IT, Nifty Pharma, Nifty India Consumption ETFs (Nippon India ETF suite, tactical overlay only)",
    factorETFs: "Nippon India/ICICI Prudential Nifty Alpha Low-Volatility 30 ETF, Nifty 200 Momentum 30 and Nifty500 Value 50-linked ETFs",
    commodityETFs: "Nippon India ETF Gold BeES, Nippon India ETF Silver BeES",
    debtCashETFs: "Bharat Bond ETF (maturity-matched to horizon), Nippon India ETF Nifty 1D Rate Liquid BeES, LIC MF Nifty 8-13yr G-Sec ETF",
    reits: "Embassy Office Parks REIT, Mindspace Business Parks REIT, Brookfield India Real Estate Trust, Nexus Select Trust",
    invits: "IndiGrid Infrastructure Trust, PowerGrid InvIT, National Highways Infra Trust (Aggressive/Moderate may add IRB InvIT for higher yield/higher risk)"
  },
  benchmark: "Aggressive: 75% Nifty 500 TRI + 25% Nifty REITs & InvITs Index. Moderate: 50% Nifty 500 TRI + 20% Nifty REITs & InvITs Index + 30% CRISIL Composite Bond Index. Conservative: 25% Nifty 500 TRI + 15% Nifty REITs & InvITs Index + 60% CRISIL Composite Bond Index.",
  rebalanceFrequency: "Quarterly calendar rebalance to target bands across all three variants; risk-band drift check monthly (rebalance triggered early if any sleeve breaches its band by >5 percentage points).",
  riskProfile: "Variant-dependent: Aggressive = High, Moderate = Moderate, Conservative = Low-Moderate",
  suitability: "Investors who want multi-asset diversification but prefer to avoid single-stock risk entirely, choosing the variant matched to their declared risk profile via a standard risk-assessment questionnaire.",
  minInvestment: "As per smallcase platform minimum for each variant.",
  fees: "To be finalized before launch — likely uniform subscription fee across the three variants.",
  taxNote: "To be detailed in a future revision (ETF capital gains, REIT/InvIT distribution component taxability).",
  keyRisks: [
    "Sectoral/factor ETF tactical sleeves can whipsaw in choppy markets",
    "REIT/InvIT sleeve concentrated in ~9 listed instruments (limited universe in India as of 2026)",
    "Conservative variant still carries ~20-30% equity-like exposure — not a capital-guarantee product",
    "ETF tracking error versus underlying index, especially in less liquid factor ETFs"
  ]
},
{
  id: "P4",
  code: "DMAMF-RB",
  name: "Discretionary Multi-Asset Mutual Fund Portfolio — Risk-Profiled (Aggressive/Moderate/Conservative)",
  shortName: "Discretionary Multi-Asset MF — by Risk Profile",
  category: "Discretionary — Multi Asset, Mutual Funds only",
  assetClasses: ["Index Funds", "Sector Funds", "Factor/Smart-Beta Funds", "Commodity Funds (Gold/Silver FoF)", "Debt/Liquid Funds", "REIT/InvIT-focused Funds/FoFs"],
  objective: "To replicate the multi-asset diversification of Product 3 using open-ended mutual fund schemes instead of ETFs — for investors who prefer SIP/lumpsum mutual fund rails, don't have (or don't want) a demat/trading account workflow for every transaction, and are comfortable with fund-level expense ratios instead of brokerage/impact cost.",
  philosophy: "Mutual funds settle T+2/T+3, don't require intraday trading, and support SIPs — a meaningfully different operational profile from ETFs despite tracking similar underlying indices. This product exists as the MF-native equivalent of Product 3 for investors and distributors who operate primarily through the mutual fund ecosystem (folios, SIPs, direct plans).",
  variants: [
    {
      profile: "Aggressive",
      allocation: [
        { sleeve: "Index Funds (Nifty 50/Next 50/Midcap 150)", range: "30–40%" },
        { sleeve: "Factor/Smart-beta Funds (Momentum/Alpha)", range: "15–20%" },
        { sleeve: "Sector Funds (tactical)", range: "5–10%" },
        { sleeve: "REIT/InvIT-oriented Funds/FoFs", range: "12–18%" },
        { sleeve: "Commodity Funds (Gold/Silver FoF)", range: "3–7%" },
        { sleeve: "Debt/Liquid Funds", range: "5–10%" }
      ]
    },
    {
      profile: "Moderate",
      allocation: [
        { sleeve: "Index Funds", range: "20–28%" },
        { sleeve: "Factor/Smart-beta Funds (Quality/Low-Vol)", range: "10–15%" },
        { sleeve: "Sector Funds (tactical)", range: "0–8%" },
        { sleeve: "REIT/InvIT-oriented Funds/FoFs", range: "15–20%" },
        { sleeve: "Commodity Funds (Gold/Silver FoF)", range: "5–10%" },
        { sleeve: "Debt/Liquid Funds", range: "20–30%" }
      ]
    },
    {
      profile: "Conservative",
      allocation: [
        { sleeve: "Index Funds (large-cap only)", range: "8–15%" },
        { sleeve: "Factor/Smart-beta Funds (Low-Vol only)", range: "5–8%" },
        { sleeve: "Sector Funds", range: "0%" },
        { sleeve: "REIT/InvIT-oriented Funds/FoFs", range: "10–15%" },
        { sleeve: "Commodity Funds (Gold FoF)", range: "5–10%" },
        { sleeve: "Debt/Liquid Funds", range: "45–60%" }
      ]
    }
  ],
  indicativeInstruments: {
    indexFunds: "Motilal Oswal / Nippon India / ICICI Pru / SBI / UTI Nifty 50, Nifty Next 50 and Nifty Midcap 150 Index Funds (direct plan)",
    factorFunds: "Nippon India Nifty Alpha Low Volatility 30 Index Fund, Edelweiss Nifty Alpha Low Vol 30 Index Fund, index funds tracking Nifty 200 Momentum 30 / Nifty500 Value 50",
    sectorFunds: "Banking & Financial Services, Technology, Pharma & Healthcare, and Consumption sector/thematic funds (house-approved list, tactical only)",
    commodityFunds: "Gold ETF Fund-of-Funds and Silver ETF FoF structures (e.g., Nippon India / ICICI Prudential / Kotak Gold Savings Fund) for investors without demat access",
    debtLiquidFunds: "Liquid funds, ultra-short duration funds, target-maturity debt index funds (Bharat Bond FoF variants)",
    reitInvitExposure: "Where a direct REIT/InvIT mutual fund wrapper is unavailable, exposure taken via hybrid/allocation funds with disclosed REIT/InvIT holdings, or via direct REIT/InvIT units held in the same folio-linked demat account where the platform supports it."
  },
  benchmark: "Same blended benchmarks as Product 3, substituting TRI index values (fund performance measured pre-expense-ratio drag against index TRI).",
  rebalanceFrequency: "Quarterly rebalance; fund selection (scheme-level, not just category-level) reviewed semi-annually for expense ratio, tracking error, and fund manager continuity.",
  riskProfile: "Variant-dependent: Aggressive = High, Moderate = Moderate, Conservative = Low-Moderate",
  suitability: "Investors preferring the mutual fund operational rail (SIP, no demat dependency for every leg) over direct ETF trading, matched to declared risk profile.",
  minInvestment: "As per smallcase platform / SIP minimum per fund (typically ₹500–₹5,000 per fund per month for SIP mode).",
  fees: "To be finalized before launch. Note: underlying fund expense ratios apply in addition to any platform subscription fee — this is structurally different from the ETF variant and should be disclosed prominently.",
  taxNote: "To be detailed in a future revision (equity fund vs debt fund taxation post the 2023 debt fund indexation changes, FoF taxation treated as debt-fund-equivalent for gold/silver FoFs).",
  keyRisks: [
    "Double-layer cost: platform fee plus underlying fund expense ratio",
    "Tracking error varies meaningfully by AMC — scheme selection matters as much as category allocation",
    "Limited direct REIT/InvIT mutual fund wrappers in India as of 2026 — this sleeve is structurally weaker via MF route than via direct ETF/unit route",
    "SIP-based averaging can lag lumpsum discretionary timing in strong trending markets"
  ]
},
{
  id: "P5",
  code: "DMAERI-GOAL",
  name: "Discretionary Multi-Asset ETF/REIT/InvIT Portfolio — by Life Goal × Risk Profile",
  shortName: "Discretionary Multi-Asset ETF/REIT/InvIT — Goal-Based",
  category: "Discretionary — Multi Asset, ETF/REIT/InvIT, Goal-Based",
  assetClasses: ["Index ETFs", "Sectoral ETFs", "Factor ETFs", "Commodity ETFs", "Debt/Cash ETFs", "REITs", "InvITs"],
  objective: "To map the Product 3 ETF/REIT/InvIT universe onto specific life goals — retirement, child's education, home down-payment, wealth accumulation — by combining goal time horizon with the investor's risk profile, using a glide-path approach that de-risks automatically as the goal date approaches.",
  philosophy: "Risk profile alone is incomplete without a time horizon anchor. A 28-year-old saving for retirement in 30 years and a 55-year-old saving for retirement in 3 years may both call themselves 'moderate risk' but need very different portfolios. This product cross-tabulates goal horizon (which sets the glide path) with declared risk tolerance (which sets the glide path's starting aggressiveness and floor), using the same ETF/REIT/InvIT universe as Product 3.",
  goalFramework: [
    {
      goal: "Retirement (long horizon, 15+ years)",
      horizonBand: "15+ years to goal",
      glidePath: "Starts at Aggressive-equivalent allocation (per Product 3), holds until T-10 years, then linearly de-risks toward Conservative-equivalent by the goal date, increasing debt/cash and REIT/InvIT income sleeves at the expense of factor/sectoral ETFs.",
      riskProfileAdjustment: "Aggressive investor: stays at upper equity band longer (to T-7yrs). Conservative investor: begins de-risking earlier (from T-15yrs)."
    },
    {
      goal: "Child's Education",
      horizonBand: "5–18 years to goal (goal date is largely fixed/inflexible)",
      glidePath: "Because the goal date cannot be deferred like retirement, de-risking is more front-loaded — glide begins at T-7 years regardless of risk profile, reaching a Conservative-equivalent allocation by T-2 years to avoid sequence-of-returns risk right before the expense hits.",
      riskProfileAdjustment: "Adjusts only the starting aggressiveness and pace of glide, not the requirement to be near-fully de-risked by T-1 year."
    },
    {
      goal: "Home Down-Payment",
      horizonBand: "2–7 years to goal",
      glidePath: "Short-horizon goal — starts materially more conservative than retirement/education goals even for Aggressive-risk investors, capped at Moderate-equivalent allocation maximum, with REIT/InvIT and debt/cash sleeves elevated throughout given limited time to recover from a drawdown.",
      riskProfileAdjustment: "Aggressive investor at 6–7yr horizon may use Moderate-equivalent band; Conservative investor at <3yr horizon should be routed to Product 3's Conservative variant directly rather than this goal wrapper."
    },
    {
      goal: "General Wealth Accumulation (no fixed date)",
      horizonBand: "Open-ended, reviewed annually",
      glidePath: "No mandatory glide path — allocation stays at the risk-profile-matched static band from Product 3 (Aggressive/Moderate/Conservative) until the investor declares a new goal or horizon.",
      riskProfileAdjustment: "Directly inherits the relevant Product 3 variant with no time-based modification."
    }
  ],
  portfolioConstructionNote: "Underlying instrument universe, sleeve definitions, and base allocation bands are identical to Product 3. This product's differentiation is entirely in the glide-path overlay logic layered on top of the risk-profile bands — it does not introduce new instruments.",
  benchmark: "Dynamic — benchmark blend shifts along the same glide path as the portfolio (e.g., retirement goal benchmark starts at Product 3's Aggressive benchmark and migrates toward the Conservative benchmark by goal date).",
  rebalanceFrequency: "Quarterly tactical rebalance within the current glide-path band; glide-path band itself steps down annually (or per the goal-specific schedule above) rather than continuously.",
  riskProfile: "Time-varying by design — starts at investor's risk-profile-matched level and mechanically reduces as goal date approaches.",
  suitability: "Investors with a specific, named financial goal and target date who want the portfolio to automatically de-risk rather than requiring manual rebalancing decisions as the goal nears.",
  minInvestment: "As per smallcase platform minimum; goal-tracking may require minimum SIP commitment to be meaningful (to be defined at launch).",
  fees: "To be finalized before launch.",
  taxNote: "To be detailed in a future revision.",
  keyRisks: [
    "Glide-path de-risking is calendar/time-based, not market-condition-based — it will de-risk on schedule even mid-rally or mid-selloff",
    "Fixed-date goals (education, home) are the least forgiving of a market drawdown near the goal date despite the glide path's intent to reduce that risk",
    "Requires accurate, honest goal-horizon input from the investor at setup — misstated horizon undermines the entire framework",
    "Same underlying instrument risks as Product 3 (REIT/InvIT distribution variability, ETF tracking error, sectoral tilts)"
  ]
},
{
  id: "P6",
  code: "DMAMF-GOAL",
  name: "Discretionary Multi-Asset Mutual Fund Portfolio — by Life Goal × Risk Profile",
  shortName: "Discretionary Multi-Asset MF — Goal-Based",
  category: "Discretionary — Multi Asset, Mutual Funds, Goal-Based",
  assetClasses: ["Index Funds", "Sector Funds", "Factor/Smart-Beta Funds", "Commodity Funds", "Debt/Liquid Funds", "REIT/InvIT-exposed Funds"],
  objective: "The mutual-fund-native equivalent of Product 5 — applies the same goal × risk-profile glide-path framework to the Product 4 mutual fund universe, for investors who want goal-based investing through SIP-friendly mutual fund rails rather than ETF trading.",
  philosophy: "Same rationale as Product 5, translated to the mutual fund operational rail described in Product 4. The glide-path logic (time-based de-risking, goal-specific pacing for fixed-date vs open-ended goals) is identical; only the instrument wrapper changes from ETF/REIT/InvIT units to open-ended mutual fund schemes and FoFs.",
  goalFramework: [
    {
      goal: "Retirement (long horizon, 15+ years)",
      horizonBand: "15+ years to goal",
      glidePath: "Identical structure to Product 5's retirement glide path, applied to Product 4's Aggressive→Conservative fund bands. SIP-based accumulation makes this goal particularly well-suited to the MF rail given rupee-cost-averaging over a multi-decade horizon.",
      riskProfileAdjustment: "Same logic as Product 5."
    },
    {
      goal: "Child's Education",
      horizonBand: "5–18 years to goal",
      glidePath: "Same front-loaded de-risking schedule as Product 5 (glide begins T-7 years, near-fully de-risked by T-1 year), using Product 4's mutual fund sleeves.",
      riskProfileAdjustment: "Same logic as Product 5."
    },
    {
      goal: "Home Down-Payment",
      horizonBand: "2–7 years to goal",
      glidePath: "Same short-horizon conservative cap as Product 5; MF route may be preferred here for investors without a demat account or who want to redeem via a single fund-house transaction near the goal date rather than selling multiple ETF/REIT/InvIT positions on-exchange.",
      riskProfileAdjustment: "Same logic as Product 5."
    },
    {
      goal: "General Wealth Accumulation",
      horizonBand: "Open-ended",
      glidePath: "Inherits the relevant Product 4 static risk-profile band with no time-based modification.",
      riskProfileAdjustment: "Direct inheritance, as in Product 5."
    }
  ],
  portfolioConstructionNote: "Underlying instrument universe and base allocation bands identical to Product 4. Differentiation is the glide-path overlay only.",
  benchmark: "Dynamic — same glide-path benchmark logic as Product 5, using Product 4's underlying blended benchmarks.",
  rebalanceFrequency: "Quarterly within-band rebalance; annual (or goal-specific) glide-path step-down; scheme-level review semi-annually per Product 4.",
  riskProfile: "Time-varying by design, per goal and declared risk profile.",
  suitability: "Investors with a named goal and target date who prefer the mutual fund/SIP operational rail over ETF trading.",
  minInvestment: "As per SIP/lumpsum minimums per underlying fund.",
  fees: "To be finalized before launch; underlying fund expense ratios apply in addition to platform fee (see Product 4 note).",
  taxNote: "To be detailed in a future revision.",
  keyRisks: [
    "Same glide-path timing risks as Product 5",
    "Same double-layer cost and tracking error considerations as Product 4",
    "Weaker direct REIT/InvIT wrapper availability via MF route (see Product 4) may cause this goal-based variant to under-deliver the income/real-asset sleeve versus the ETF equivalent (Product 5) for income-sensitive goals like retirement"
  ]
},
{
  id: "P7",
  code: "SSFP-RB",
  name: "Systematic Stock Factor Portfolios — Risk-Profiled (Aggressive/Moderate/Conservative)",
  shortName: "Systematic Factor Equity — by Risk Profile",
  category: "Systematic — Single Asset Class (Equity, Rules-Based)",
  assetClasses: ["Indian Equities (direct stocks, factor-screened)"],
  objective: "To deliver factor-premia-driven equity returns through a fully rules-based, systematic (non-discretionary) stock selection process, offered in three variants that differ in factor mix and cap-segment exposure to match Aggressive, Moderate, and Conservative risk appetites — in contrast to Products 1–6, which are discretionarily managed.",
  philosophy: "This product family removes manager discretion from security selection entirely. Stocks are ranked and selected purely by quantitative factor scores (momentum, quality, value, low-volatility, alpha) recomputed on a fixed schedule, following the same construction logic NSE uses for its official strategy indices (Nifty200 Momentum 30, Nifty200 Quality 30, Nifty500 Value 50, Nifty Alpha Low-Volatility 30, and their multi-factor combinations). The only 'discretionary' element is the initial choice of which factor blend and risk band an investor is placed in — thereafter the portfolio rebalances mechanically.",
  variants: [
    {
      profile: "Aggressive",
      factorMix: "60% Momentum, 25% Alpha, 15% Quality",
      universe: "Nifty 200 (large + mid-cap)",
      stockCount: "25–30",
      rationale: "Momentum and alpha factors have historically shown the highest returns but also the highest turnover and drawdown risk — appropriate only for high risk tolerance.",
      referenceIndex: "Nifty 200 Momentum 30 / Nifty Alpha 50 construction logic"
    },
    {
      profile: "Moderate",
      factorMix: "35% Quality, 30% Alpha, 20% Low-Volatility, 15% Momentum",
      universe: "Nifty 200",
      stockCount: "30",
      rationale: "Blending quality and low-volatility with alpha/momentum dampens drawdowns while retaining meaningful factor premia capture — the NSE 'Alpha Quality Low-Volatility 30' style blend.",
      referenceIndex: "Nifty Alpha Quality Low-Volatility 30 construction logic"
    },
    {
      profile: "Conservative",
      factorMix: "40% Low-Volatility, 30% Quality, 30% Value",
      universe: "Nifty 100 (large-cap only)",
      stockCount: "30",
      rationale: "Prioritizes capital stability — low-volatility and quality factors have historically delivered the smallest drawdowns of any single-factor strategy, at some cost to upside capture in strong bull phases.",
      referenceIndex: "Nifty100 Quality 30 / Nifty100 Low Volatility 30 construction logic"
    }
  ],
  selectionMethodology: "Factor scores computed quarterly using trailing 12-month price momentum (for momentum), 5-year ROE/leverage/earnings-variability composite (for quality), E/P-B/P-S/P-dividend yield composite (for value), and trailing volatility/beta (for low-volatility), following NSE Indices' published methodology for equivalent strategy indices. Stocks ranked, top N selected per variant, weighted by factor score (not equal-weight, not free-float market cap) subject to a single-stock cap of 8% and sector cap of 30%.",
  benchmark: "Aggressive: Nifty 200 Momentum 30 TRI. Moderate: Nifty Alpha Quality Low-Volatility 30 TRI. Conservative: Nifty100 Low Volatility 30 TRI / Nifty100 Quality 30 TRI blend.",
  rebalanceFrequency: "Quarterly, calendar-scheduled (aligned to NSE Indices' own quarterly review cycle for comparability), fully mechanical — no ad hoc discretionary rebalancing outside the schedule except for corporate actions (delisting, M&A) requiring an immediate substitution.",
  riskProfile: "Variant-dependent: Aggressive = High, Moderate = Moderate-High, Conservative = Moderate",
  suitability: "Investors who prefer rules-based, emotion-free systematic exposure over discretionary stock-picking, and who understand factor investing can underperform the broad market for extended periods (factor drawdowns/'crowding' cycles).",
  minInvestment: "As per smallcase platform minimum.",
  fees: "To be finalized before launch — systematic products typically command a lower fee than discretionary products given the absence of active management; to be reflected in final pricing.",
  taxNote: "To be detailed in a future revision.",
  keyRisks: [
    "Factor premia are cyclical and can underperform market-cap-weighted benchmarks for multi-year stretches (e.g., value underperformed growth for most of 2018–2020 in India)",
    "Mechanical rebalancing does not adapt to fundamental red flags between scheduled reviews unless a corporate-action trigger fires",
    "Higher portfolio turnover (especially Aggressive/momentum variant) increases transaction costs and short-term capital gains incidence",
    "Factor crowding risk — as factor investing has grown, some premia have compressed versus historical backtests"
  ]
},
{
  id: "P8",
  code: "SSF-REIG-RB",
  name: "Systematic Stock Factor + REITs + InvIT + Gold + Cash Portfolios — Risk-Profiled",
  shortName: "Systematic Factor + Real Assets + Gold + Cash — by Risk Profile",
  category: "Systematic — Multi Asset (Factor Equity + Real Assets + Gold + Cash)",
  assetClasses: ["Factor-screened Indian Equities", "REITs", "InvITs", "Gold (ETF)", "Cash/Debt ETF"],
  objective: "To wrap the systematic factor equity engine from Product 7 with a fixed-rules multi-asset overlay — REITs and InvITs for income/real-asset diversification, gold for inflation/tail-risk hedging, and cash/debt for stability — with all sleeve weights determined by a fixed rules-based allocation table per risk band rather than manager discretion.",
  philosophy: "This is the systematic (rules-based) counterpart to Product 2's discretionary multi-asset approach, but deliberately narrower in instrument scope: only REITs, InvITs, gold, and cash are added to the factor equity core — no sectoral tilts, no factor ETF layering, no special situations. The narrower, fixed universe keeps the entire product mechanically rebalanceable without judgment calls, which is the point of a 'systematic' offering.",
  variants: [
    {
      profile: "Aggressive",
      allocation: [
        { sleeve: "Systematic Factor Equity (Product 7 Aggressive variant)", range: "70–80%" },
        { sleeve: "REITs (equal-weighted across eligible names)", range: "5–8%" },
        { sleeve: "InvITs (equal-weighted across eligible names)", range: "5–8%" },
        { sleeve: "Gold ETF", range: "3–7%" },
        { sleeve: "Cash/Debt ETF", range: "3–7%" }
      ]
    },
    {
      profile: "Moderate",
      allocation: [
        { sleeve: "Systematic Factor Equity (Product 7 Moderate variant)", range: "50–60%" },
        { sleeve: "REITs (equal-weighted)", range: "8–12%" },
        { sleeve: "InvITs (equal-weighted)", range: "8–12%" },
        { sleeve: "Gold ETF", range: "5–10%" },
        { sleeve: "Cash/Debt ETF", range: "10–20%" }
      ]
    },
    {
      profile: "Conservative",
      allocation: [
        { sleeve: "Systematic Factor Equity (Product 7 Conservative variant)", range: "25–35%" },
        { sleeve: "REITs (equal-weighted)", range: "8–12%" },
        { sleeve: "InvITs (equal-weighted)", range: "8–12%" },
        { sleeve: "Gold ETF", range: "8–15%" },
        { sleeve: "Cash/Debt ETF", range: "30–45%" }
      ]
    }
  ],
  indicativeInstruments: {
    equity: "Per Product 7's variant-matched factor screen",
    reits: "Embassy Office Parks REIT, Mindspace Business Parks REIT, Brookfield India Real Estate Trust, Nexus Select Trust (equal-weighted, rebalanced quarterly; no discretionary over/underweighting)",
    invits: "IndiGrid Infrastructure Trust, PowerGrid InvIT, National Highways Infra Trust (equal-weighted; IRB InvIT included only in Aggressive variant given its higher yield/higher volatility profile)",
    gold: "Nippon India ETF Gold BeES (or lowest-tracking-error, highest-AUM gold ETF at each rebalance date per a fixed selection rule)",
    cashDebt: "Nippon India ETF Nifty 1D Rate Liquid BeES for the cash sleeve; Bharat Bond ETF (maturity nearest to a 3-year constant-maturity target) for the debt sleeve"
  },
  selectionMethodology: "Equity sleeve: identical mechanical factor process as Product 7. REIT/InvIT sleeves: equal-weight across all SEBI-listed, exchange-traded REITs/InvITs meeting a minimum free-float market cap and 6-month average daily traded value threshold (fixed rule, reviewed annually for universe additions as new REITs/InvITs list). Gold/cash sleeves: single-instrument or rules-based instrument selection, no discretion.",
  benchmark: "Aggressive: 75% Nifty200 Momentum 30 TRI + 15% Nifty REITs & InvITs Index + 10% Domestic Gold Price. Moderate: 55% factor-blend TRI + 20% Nifty REITs & InvITs Index + 10% Gold + 15% CRISIL Liquid Fund Index. Conservative: 30% factor-blend TRI + 20% Nifty REITs & InvITs Index + 12% Gold + 38% CRISIL Composite Bond Index.",
  rebalanceFrequency: "Quarterly, fully calendar-scheduled and mechanical across all sleeves — no discretionary intra-quarter changes except corporate-action-driven substitutions (delisting, merger).",
  riskProfile: "Variant-dependent: Aggressive = High, Moderate = Moderate, Conservative = Low-Moderate",
  suitability: "Investors wanting the diversification benefit of Product 2 but delivered through a fully rules-based, lower-discretion process with a narrower, simpler instrument set.",
  minInvestment: "As per smallcase platform minimum.",
  fees: "To be finalized before launch — expected to price below the fully discretionary Product 2 given the systematic/rules-based construction.",
  taxNote: "To be detailed in a future revision.",
  keyRisks: [
    "Equal-weight REIT/InvIT construction does not distinguish between stronger and weaker underlying real-asset fundamentals — a fixed rule, not a credit judgment",
    "Same factor cyclicality risk as Product 7 in the equity sleeve",
    "Gold sleeve is a single-instrument concentration (no diversification across gold ETF providers by design, for simplicity)",
    "Narrower instrument universe than Product 2 means less flexibility to respond to emerging opportunities (e.g., a new REIT listing enters only at the next scheduled review)"
  ]
},
{
  id: "P9",
  code: "SSF-REIG-GOAL",
  name: "Systematic Stock Factor + REITs + InvIT + Gold + Cash Portfolios — by Life Goal × Risk Profile",
  shortName: "Systematic Factor + Real Assets + Gold + Cash — Goal-Based",
  category: "Systematic — Multi Asset, Goal-Based",
  assetClasses: ["Factor-screened Indian Equities", "REITs", "InvITs", "Gold (ETF)", "Cash/Debt ETF"],
  objective: "To apply the same goal × risk-profile glide-path framework used in Products 5 and 6 to the fully systematic, rules-based Product 8 universe — giving investors a mechanical, non-discretionary, goal-aware portfolio that de-risks on a fixed schedule as the goal date approaches.",
  philosophy: "This is the most 'rules on rules' product in the suite: the equity sleeve is factor-systematic (Product 7 logic), the multi-asset overlay is fixed-allocation systematic (Product 8 logic), and the goal adaptation is a scheduled glide path (Products 5/6 logic) rather than discretionary judgment. Every allocation decision in this product — security selection, sleeve weight, and time-based de-risking — follows a pre-published rule, leaving no discretionary decision points after initial goal/risk-profile classification.",
  goalFramework: [
    {
      goal: "Retirement (15+ years)",
      horizonBand: "15+ years to goal",
      glidePath: "Starts at Product 8's Aggressive variant, holds until T-10 years, then steps down annually through Moderate toward Conservative by the goal date — identical step-down calendar logic to Product 5/6, applied to Product 8's fixed sleeve weights at each step.",
    },
    {
      goal: "Child's Education (5–18 years)",
      horizonBand: "5–18 years to goal",
      glidePath: "Front-loaded de-risking from T-7 years to near-fully Conservative by T-1 year, per the Product 5/6 education schedule, using Product 8's mechanical sleeve construction at each step."
    },
    {
      goal: "Home Down-Payment (2–7 years)",
      horizonBand: "2–7 years to goal",
      glidePath: "Capped at Moderate-equivalent even for Aggressive-risk investors beyond a 6-year horizon; below 3 years, investor is routed directly to Product 8's Conservative variant rather than a goal-wrapped glide."
    },
    {
      goal: "General Wealth Accumulation",
      horizonBand: "Open-ended",
      glidePath: "Static allocation at the investor's declared risk-profile-matched Product 8 variant; no time-based step-down."
    }
  ],
  portfolioConstructionNote: "No new instruments or selection rules are introduced versus Product 8 — this product only adds the fixed, calendar-based glide-path step-down schedule. All equity factor screening, REIT/InvIT equal-weighting, and gold/cash instrument selection rules are inherited unchanged from Products 7 and 8.",
  benchmark: "Dynamic, glide-path-matched blend of Product 8's three variant benchmarks, stepping down on the same schedule as the portfolio.",
  rebalanceFrequency: "Quarterly mechanical rebalance within the current glide-path step; annual (or goal-specific) step-down per the schedule above — both fully calendar-driven, no discretionary triggers.",
  riskProfile: "Time-varying by design, mechanically determined by goal horizon and declared risk profile — the least discretionary product in the entire suite.",
  suitability: "Investors who want maximum rules-based transparency and minimum manager discretion in a goal-based multi-asset product — e.g., investors who specifically want to avoid manager judgment calls at every level of the portfolio.",
  minInvestment: "As per smallcase platform minimum.",
  fees: "To be finalized before launch — expected to be the lowest-cost product in the suite given full systematic construction at both the security-selection and glide-path level.",
  taxNote: "To be detailed in a future revision.",
  keyRisks: [
    "Same glide-path timing risk as Products 5/6 — de-risks on schedule regardless of market conditions",
    "Same factor cyclicality and equal-weight REIT/InvIT construction risks as Products 7/8",
    "Zero discretionary override means the product cannot deviate from its rules even if a manager would judge deviation prudent (e.g., an obviously deteriorating REIT sponsor) — by design, but worth flagging explicitly to investors as a trade-off, not an oversight"
  ]
}
];

if (typeof module !== "undefined" && module.exports) { module.exports = PRODUCTS; }
