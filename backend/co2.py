"""
Dynamic CO2 Emission Factor Calculator
=======================================
Grid carbon intensity varies by time-of-day:
- Solar hours (8AM-4PM): low emissions (solar + wind on grid)
- Evening peak (6PM-10PM): high emissions (coal peaker plants spin up)
All factors in gCO2/kWh based on Indian grid averages.
"""

# Time-of-day emission factors (gCO2/kWh)
# Hour -> gCO2/kWh
EMISSION_PROFILE = {
    0: 820, 1: 840, 2: 850, 3: 855, 4: 850, 5: 830,   # Night: coal heavy
    6: 780, 7: 700, 8: 580, 9: 450, 10: 350, 11: 280,   # Morning: solar ramping
    12: 250, 13: 240, 14: 260, 15: 300, 16: 380, 17: 500, # Midday low, afternoon rising
    18: 680, 19: 780, 20: 820, 21: 840, 22: 830, 23: 825  # Evening peak: peakers
}

# Grid tariff (₹/kWh) by hour — Time-of-Use pricing
TARIFF_PROFILE = {
    0: 4.5, 1: 4.2, 2: 4.0, 3: 4.0, 4: 4.2, 5: 4.5,
    6: 5.5, 7: 7.0, 8: 6.5, 9: 5.5, 10: 5.0, 11: 4.8,
    12: 4.5, 13: 4.3, 14: 4.5, 15: 5.0, 16: 6.0, 17: 7.5,
    18: 9.0, 19: 9.5, 20: 9.0, 21: 8.5, 22: 7.0, 23: 5.5
}


def get_emission_factor(hour: int) -> float:
    """Return grid emission factor (gCO2/kWh) for given hour."""
    return EMISSION_PROFILE.get(hour % 24, 750)


def get_tariff(hour: int) -> float:
    """Return electricity tariff (₹/kWh) for given hour."""
    return TARIFF_PROFILE.get(hour % 24, 6.0)


def calculate_co2_savings(
    hour: int,
    grid_import_kw: float,
    smart_grid_import_kw: float,
    duration_hours: float = 1/3600
) -> dict:
    """
    Calculate CO2 saved by smart load-shifting vs dumb baseline.
    
    Args:
        hour: Current hour (0-23)
        grid_import_kw: Dumb baseline grid import (kW)
        smart_grid_import_kw: Opti-Zero smart grid import (kW)
        duration_hours: Time interval in hours
    
    Returns:
        dict with co2_saved_grams, tariff_saved_inr, emission_factor
    """
    ef = get_emission_factor(hour)  # gCO2/kWh
    tariff = get_tariff(hour)        # ₹/kWh

    baseline_co2 = grid_import_kw * ef * duration_hours       # grams
    smart_co2 = smart_grid_import_kw * ef * duration_hours    # grams

    baseline_cost = grid_import_kw * tariff * duration_hours  # ₹
    smart_cost = smart_grid_import_kw * tariff * duration_hours  # ₹

    return {
        "emission_factor_g_kwh": ef,
        "tariff_inr_kwh": tariff,
        "co2_saved_grams": max(0, baseline_co2 - smart_co2),
        "cost_saved_inr": max(0, baseline_cost - smart_cost),
        "peaker_plant_avoided": (grid_import_kw - smart_grid_import_kw) > 5.0  # >5kW = peaker avoided
    }


def daily_co2_summary(hourly_data: list) -> dict:
    """
    Summarize full-day CO2 and cost savings.
    hourly_data: list of dicts with 'hour', 'baseline_kw', 'smart_kw'
    """
    total_co2_saved_kg = 0
    total_cost_saved_inr = 0
    total_baseline_energy_kwh = 0
    total_smart_energy_kwh = 0

    for entry in hourly_data:
        h = entry["hour"]
        base_kw = entry["baseline_kw"]
        smart_kw = entry["smart_kw"]
        ef = get_emission_factor(h)
        tariff = get_tariff(h)

        total_co2_saved_kg += (base_kw - smart_kw) * ef / 1000  # kg
        total_cost_saved_inr += (base_kw - smart_kw) * tariff
        total_baseline_energy_kwh += base_kw
        total_smart_energy_kwh += smart_kw

    return {
        "total_co2_saved_kg_per_day": round(max(0, total_co2_saved_kg), 2),
        "total_co2_saved_tons_per_year": round(max(0, total_co2_saved_kg) * 365 / 1000, 2),
        "total_cost_saved_inr_per_day": round(max(0, total_cost_saved_inr), 2),
        "total_cost_saved_inr_per_year": round(max(0, total_cost_saved_inr) * 365, 2),
        "baseline_energy_kwh": round(total_baseline_energy_kwh, 2),
        "smart_energy_kwh": round(total_smart_energy_kwh, 2),
        "energy_reduction_percent": round(
            max(0, (total_baseline_energy_kwh - total_smart_energy_kwh) / max(1, total_baseline_energy_kwh) * 100), 1
        )
    }
