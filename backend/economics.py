"""
Economic Analysis Engine
=========================
Calculates LCOE, Payback Period, Battery Degradation Cost,
Ancillary Services Revenue, and full ROI for the Opti-Zero system.

All monetary values in Indian Rupees (₹).
"""

import math

# ── System Configuration ──────────────────────────────────────────────────────
SOLAR_SYSTEM_KW = 50.0          # kW peak installed
SOLAR_COST_PER_KW = 45_000      # ₹/kW (installed cost in India 2024)
BESS_CAPACITY_KWH = 100.0       # kWh battery bank
BESS_COST_PER_KWH = 25_000      # ₹/kWh (LFP chemistry)
INVERTER_COST = 1_50_000        # ₹ (bidirectional inverter)
INSTALLATION_COST = 2_00_000    # ₹

SOLAR_LIFETIME_YEARS = 25
BESS_NAIVE_LIFETIME_YEARS = 5   # Without Opti-Zero (aggressive cycling)
BESS_OPTIMIZED_LIFETIME_YEARS = 10  # With Opti-Zero (smart DoD control)

SOLAR_DEGRADATION_RATE = 0.005  # 0.5%/year efficiency loss
O_AND_M_COST_PER_YEAR = 30_000  # ₹/year operations & maintenance

AVERAGE_TARIFF_INR_PER_KWH = 7.0   # ₹/kWh blended average
PEAK_TARIFF_INR_PER_KWH = 9.5      # ₹/kWh peak hours
ANCILLARY_SERVICE_PRICE_KWH = 0.15   # ₹/kWh SRAS price
FREQUENCY_REG_CAPACITY_KW = 24.4     # kW bid into ancillary market

# ── Capital Cost ──────────────────────────────────────────────────────────────

def total_capital_cost() -> dict:
    solar_cost = SOLAR_SYSTEM_KW * SOLAR_COST_PER_KW
    bess_cost = BESS_CAPACITY_KWH * BESS_COST_PER_KWH
    total = solar_cost + bess_cost + INVERTER_COST + INSTALLATION_COST
    return {
        "solar_array_cost_inr": solar_cost,
        "bess_cost_inr": bess_cost,
        "inverter_cost_inr": INVERTER_COST,
        "installation_cost_inr": INSTALLATION_COST,
        "total_capex_inr": total
    }


# ── Solar Energy Production ───────────────────────────────────────────────────

def annual_solar_energy_kwh(year: int = 1) -> float:
    """
    Annual energy production accounting for panel degradation.
    Uses: E = P_rated × PSH × 365 × (1-degradation)^year
    PSH = Peak Sun Hours (India average ~5.5 h/day)
    """
    psh = 5.5  # Peak Sun Hours/day (India average)
    efficiency_factor = (1 - SOLAR_DEGRADATION_RATE) ** (year - 1)
    return SOLAR_SYSTEM_KW * psh * 365 * efficiency_factor


# ── LCOE – Levelized Cost of Energy ──────────────────────────────────────────

def calculate_lcoe(discount_rate: float = 0.08) -> dict:
    """
    LCOE = (Total Discounted Costs) / (Total Discounted Energy)
    Uses 8% discount rate (typical India infrastructure).
    """
    capex = total_capital_cost()["total_capex_inr"]
    total_cost_pv = capex  # Present value of costs
    total_energy_pv = 0.0  # Present value of energy

    for year in range(1, SOLAR_LIFETIME_YEARS + 1):
        discount_factor = 1 / (1 + discount_rate) ** year
        annual_cost = O_AND_M_COST_PER_YEAR * discount_factor
        annual_energy = annual_solar_energy_kwh(year) * discount_factor
        total_cost_pv += annual_cost
        total_energy_pv += annual_energy

    lcoe = total_cost_pv / total_energy_pv if total_energy_pv > 0 else 0

    return {
        "lcoe_inr_per_kwh": round(lcoe, 2),
        "total_cost_pv_inr": round(total_cost_pv, 0),
        "total_energy_pv_kwh": round(total_energy_pv, 0),
        "vs_grid_tariff_inr_kwh": AVERAGE_TARIFF_INR_PER_KWH,
        "savings_per_kwh_inr": round(AVERAGE_TARIFF_INR_PER_KWH - lcoe, 2)
    }


# ── Payback Period ────────────────────────────────────────────────────────────

def calculate_payback() -> dict:
    """
    Simple Payback = Total CAPEX / Annual Net Savings
    Annual savings = energy cost avoided + ancillary services revenue
    """
    capex = total_capital_cost()["total_capex_inr"]
    annual_energy = annual_solar_energy_kwh(1)

    energy_savings = annual_energy * AVERAGE_TARIFF_INR_PER_KWH
    ancillary_revenue = FREQUENCY_REG_CAPACITY_KW * 8760 * 0.80 * ANCILLARY_SERVICE_PRICE_KWH
    total_annual_savings = energy_savings + ancillary_revenue - O_AND_M_COST_PER_YEAR

    payback_years = capex / total_annual_savings if total_annual_savings > 0 else 999

    # NPV over 25 years at 8% discount
    discount_rate = 0.08
    npv = -capex
    for year in range(1, SOLAR_LIFETIME_YEARS + 1):
        annual_saving = total_annual_savings * (1 - SOLAR_DEGRADATION_RATE) ** (year - 1)
        npv += annual_saving / (1 + discount_rate) ** year

    roi_percent = (total_annual_savings / capex) * 100  # Return on Investment

    return {
        "payback_years": round(payback_years, 1),
        "annual_energy_savings_inr": round(energy_savings, 0),
        "ancillary_revenue_inr_per_year": round(ancillary_revenue, 0),
        "total_annual_savings_inr": round(total_annual_savings, 0),
        "npv_25yr_inr": round(npv, 0),
        "roi_percent": round(roi_percent, 1),
        "total_capex_inr": round(capex, 0)
    }


# ── Battery Degradation Analysis ─────────────────────────────────────────────

def battery_degradation_analysis() -> dict:
    """
    Compare naive vs. Opti-Zero battery lifecycle.
    
    Naive: Deep discharge cycles every day → 5yr life
    Opti-Zero: Smart DoD control (max 80% DoD, avoid extreme temps) → 10yr life
    
    Savings = Cost of 1 replacement avoided = BESS_CAPACITY_KWH * BESS_COST_PER_KWH
    """
    bess_cost = BESS_CAPACITY_KWH * BESS_COST_PER_KWH

    # Naive: need 4 replacements in 25yr system life (every 5 yr → at 5,10,15,20)
    naive_replacements = math.floor(SOLAR_LIFETIME_YEARS / BESS_NAIVE_LIFETIME_YEARS) - 1
    naive_total_replacement_cost = naive_replacements * bess_cost

    # Optimized: need 2 replacements (every 10yr → at 10, 20)
    optimized_replacements = math.floor(SOLAR_LIFETIME_YEARS / BESS_OPTIMIZED_LIFETIME_YEARS) - 1
    optimized_total_replacement_cost = optimized_replacements * bess_cost

    savings = naive_total_replacement_cost - optimized_total_replacement_cost

    return {
        "bess_initial_cost_inr": bess_cost,
        "naive_lifetime_years": BESS_NAIVE_LIFETIME_YEARS,
        "optimized_lifetime_years": BESS_OPTIMIZED_LIFETIME_YEARS,
        "naive_replacements_in_25yr": naive_replacements,
        "optimized_replacements_in_25yr": optimized_replacements,
        "naive_replacement_cost_inr": naive_total_replacement_cost,
        "optimized_replacement_cost_inr": optimized_total_replacement_cost,
        "savings_from_smart_cycling_inr": round(savings, 0),
        "savings_label": f"₹{savings:,.0f} saved by smart battery cycling"
    }


# ── Monthly Bill Comparison ───────────────────────────────────────────────────

def monthly_bill_comparison() -> dict:
    """
    Compare monthly electricity costs: without solar vs. with Opti-Zero.
    Baseline building load: ~150 kWh/day commercial building
    """
    daily_load_kwh = 150
    monthly_kwh = daily_load_kwh * 30
    FIXED_DEMAND_CHARGE = 4500  # ₹/month (TANGEDCO Commercial Tariff)

    # Baseline: buy everything from grid at blended tariff
    baseline_bill = (monthly_kwh * AVERAGE_TARIFF_INR_PER_KWH) + FIXED_DEMAND_CHARGE

    # Opti-Zero: solar covers ~70% during the day; night load on grid at off-peak rate
    solar_monthly_kwh = annual_solar_energy_kwh(1) / 12
    grid_import_monthly = max(0, monthly_kwh - solar_monthly_kwh)
    smart_bill = (grid_import_monthly * 5.5) + FIXED_DEMAND_CHARGE

    savings = baseline_bill - smart_bill

    return {
        "monthly_kwh_consumption": round(monthly_kwh, 0),
        "baseline_monthly_bill_inr": round(baseline_bill, 0),
        "optizero_monthly_bill_inr": round(smart_bill, 0),
        "monthly_savings_inr": round(savings, 0),
        "annual_savings_inr": round(savings * 12, 0),
        "reduction_percent": round(savings / baseline_bill * 100, 1)
    }


# ── Full Summary ──────────────────────────────────────────────────────────────

def full_economic_summary() -> dict:
    return {
        "capital_cost": total_capital_cost(),
        "lcoe": calculate_lcoe(),
        "payback": calculate_payback(),
        "battery_analysis": battery_degradation_analysis(),
        "bill_comparison": monthly_bill_comparison()
    }
