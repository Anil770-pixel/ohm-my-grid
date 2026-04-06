"""
24-Hour Digital Twin Simulator
================================
Simulates the real-time power dynamics of a Net-Zero commercial building:
- Solar generation using P = A × r × H × PR (with temperature loss noise)
- Building load as a realistic duck curve
- BESS charging/discharging logic
- Power Factor correction and reactive power penalties
- Smart vs Dumb scheduling baseline comparison
"""

import math
import random
import time
from typing import Dict, Any, List

# ── Solar PV System Parameters ────────────────────────────────────────────────
SOLAR_AREA_M2 = 250.0           # m² of panel area (rooftop)
SOLAR_EFFICIENCY = 0.20         # r: panel conversion efficiency (20% monocrystalline)
PERFORMANCE_RATIO = 0.78        # PR: accounts for wiring/inverter/soiling losses
PANEL_TEMP_COEFF = -0.0045      # -%/°C above 25°C (typical Si panel)
BASE_AMBIENT_TEMP = 32.0        # °C ambient (India average)

# ── BESS Parameters ───────────────────────────────────────────────────────────
BESS_CAPACITY_KWH = 100.0
BESS_ROUND_TRIP_EFF = 0.93      # 93% round-trip efficiency (LFP chemistry)
MAX_CHARGE_KW = 25.0
MAX_DISCHARGE_KW = 30.0
BESS_MIN_SOC = 0.15
BESS_MAX_SOC = 0.95

# ── Building Parameters ───────────────────────────────────────────────────────
BUILDING_POWER_FACTOR = 0.88    # PF of building loads (inductive HVAC motors)
EV_CHARGER_KW = 15.0            # EV charging station power
HVAC_BASE_KW = 20.0             # HVAC baseline
OFFICE_LOAD_KW = 30.0           # Constant office equipment load


def solar_irradiance_kw_per_m2(hour: float) -> float:
    """
    Generate realistic solar irradiance curve for a clear day in India.
    Peaks around 12-1 PM. Returns kW/m² (H in the solar formula).
    """
    if hour < 6.0 or hour > 19.0:
        return 0.0
    # Sine curve centered at 12.5 (solar noon shifted for India)
    peak = 0.95  # kW/m² (typical clear-sky in Karnataka/Maharashtra)
    angle = math.pi * (hour - 6.0) / 13.0
    base = peak * math.sin(angle)
    # Add ±5% random cloud noise
    noise = random.uniform(-0.05, 0.05) * base
    return max(0.0, base + noise)


def solar_power_kw(hour: float) -> float:
    """
    P_solar = A × r × H × PR × temperature_correction
    
    Temperature correction: panels lose efficiency when hot.
    Cell temp ≈ ambient + irradiance × 0.03 (NOCT model simplified)
    """
    H = solar_irradiance_kw_per_m2(hour)
    if H <= 0:
        return 0.0

    # NOCT model: cell temperature rises with irradiance
    cell_temp = BASE_AMBIENT_TEMP + H * 1000 * 0.03  # °C
    temp_delta = cell_temp - 25.0  # Above STC reference temp

    # Temperature correction factor
    temp_correction = 1 + (PANEL_TEMP_COEFF * temp_delta)
    temp_correction = max(0.7, temp_correction)  # Floor at 70%

    P_solar = SOLAR_AREA_M2 * SOLAR_EFFICIENCY * H * PERFORMANCE_RATIO * temp_correction
    return round(P_solar, 2)


def building_load_kw(hour: float, is_smart: bool = True) -> float:
    """
    Generate realistic "duck curve" building load profile.
    
    Baseline (dumb):  EV charges at 6PM, HVAC at full power evening
    Smart (Opti-Zero): EV pre-charged at 1PM via solar, HVAC pre-cool at 2PM
    
    Peaks: ~7-8AM (morning startup) and 6-9PM (evening peak)
    """
    # Base office load — people + equipment
    if 7.0 <= hour <= 19.0:
        base = OFFICE_LOAD_KW + 10.0  # Occupied
    else:
        base = OFFICE_LOAD_KW * 0.2   # Night standby

    # HVAC load: depends on outdoor temp and occupancy
    if 8.0 <= hour <= 18.0:
        hvac = HVAC_BASE_KW * (1.0 + 0.3 * math.sin(math.pi * (hour - 8) / 10))
    elif 18.0 < hour <= 22.0:
        if is_smart:
            # Pre-cooling done → HVAC runs light in evening
            hvac = HVAC_BASE_KW * 0.6
        else:
            # Naive: full HVAC in hot evening
            hvac = HVAC_BASE_KW * 1.2
    else:
        hvac = HVAC_BASE_KW * 0.15  # Night minimal

    # EV charging
    if is_smart:
        # Smart: charge at 1PM (solar peak surplus)
        ev = EV_CHARGER_KW if 12.5 <= hour <= 14.5 else 0
    else:
        # Dumb: charge at 6PM (grid peak, coal-heavy)
        ev = EV_CHARGER_KW if 17.5 <= hour <= 19.5 else 0

    # Morning startup spike
    morning_spike = 8.0 if 7.0 <= hour <= 8.0 else 0.0

    total = base + hvac + ev + morning_spike
    noise = random.uniform(-1.0, 1.0)
    return round(max(0, total + noise), 2)


def power_factor_analysis(real_kw: float, pf: float = BUILDING_POWER_FACTOR, bess_kvar_comp: bool = False) -> dict:
    if real_kw <= 0:
        return {"real_kw": 0, "apparent_kva": 0, "reactive_kvar": 0, "power_factor": pf, "pf_penalty_inr_hr": 0, "kvar_compensation_active": False}

    apparent_kva = real_kw / pf
    reactive_kvar = math.sqrt(max(0, apparent_kva**2 - real_kw**2))
    
    # EEE Logic: If BESS VAR compensation is active, it injects leading kVAR
    # to cancel the inductive lagging kVAR.
    if bess_kvar_comp:
        reactive_kvar = reactive_kvar * 0.1  # 90% cancellation
        
    final_apparent = math.sqrt(real_kw**2 + reactive_kvar**2)
    final_pf = real_kw / final_apparent if final_apparent > 0 else 1.0

    # Penalty: DISCOMs charge ₹150/kVAR/month if PF < 0.90
    monthly_kvar_charge = 150  # ₹/kVAR/month
    hourly_penalty = 0.0
    if final_pf < 0.90:
        hourly_penalty = reactive_kvar * monthly_kvar_charge / (30 * 24)

    return {
        "real_kw": round(real_kw, 2),
        "apparent_kva": round(final_apparent, 2),
        "reactive_kvar": round(reactive_kvar, 2),
        "power_factor": round(final_pf, 3),
        "pf_penalty_inr_hr": round(hourly_penalty, 2),
        "kvar_compensation_active": bess_kvar_comp
    }


class BuildingSimulator:
    """
    Real-time 24-hour simulator running as an async loop.
    Advances simulation time at configurable speed ratio.
    Each real second = 2 minutes of simulated time (720× time compression).
    """

    def __init__(self, speed_minutes_per_second: float = 2.0):
        self.speed = speed_minutes_per_second  # 2 sim-minutes per real-second
        self.sim_hour: float = 6.0  # Start at 6 AM
        self.bess_soc: float = 0.85
        self.bess_kvar_compensation = False  # New feature: Active VAR support
        self._start_real_time = time.time()
        self._cumulative_solar_kwh = 0.0
        self._cumulative_load_kwh = 0.0
        self._cumulative_grid_import_kwh = 0.0
        self._cumulative_co2_kg = 0.0

    def step(self) -> Dict[str, Any]:
        """Advance simulation by one real second and return state."""
        # Advance simulated time
        self.sim_hour = (self.sim_hour + self.speed / 60.0) % 24.0
        hour = self.sim_hour
        hour_int = int(hour)

        # ── Power Generation & Load ────────────────────────────────────────
        solar_kw = solar_power_kw(hour)
        smart_load_kw = building_load_kw(hour, is_smart=True)
        dumb_load_kw = building_load_kw(hour, is_smart=False)

        # ── BESS Logic ────────────────────────────────────────────────────
        net_power = solar_kw - smart_load_kw  # Positive = surplus, Negative = deficit

        bess_kw = 0.0  # Positive = discharging, Negative = charging
        grid_import_kw = 0.0
        grid_export_kw = 0.0

        if net_power < 0:
            # Deficit: discharge BESS first, then import from grid
            shortage = abs(net_power)
            max_bess_disch = min(MAX_DISCHARGE_KW, (self.bess_soc - BESS_MIN_SOC) * BESS_CAPACITY_KWH * 3)
            bess_kw = min(shortage, max_bess_disch)
            remaining = shortage - bess_kw
            grid_import_kw = max(0, remaining)
            # Deplete SOC
            self.bess_soc = max(BESS_MIN_SOC, self.bess_soc - bess_kw / BESS_CAPACITY_KWH / 3)

        elif net_power > 0:
            # Surplus: charge BESS first, then export
            surplus = net_power
            max_bess_chg = min(MAX_CHARGE_KW, (BESS_MAX_SOC - self.bess_soc) * BESS_CAPACITY_KWH * 3)
            bess_charge = min(surplus * BESS_ROUND_TRIP_EFF, max_bess_chg)
            bess_kw = -bess_charge  # Negative = charging
            grid_export_kw = max(0, surplus - bess_charge)
            # Increase SOC
            self.bess_soc = min(BESS_MAX_SOC, self.bess_soc + bess_charge / BESS_CAPACITY_KWH / 3)

        # ── Net-Zero Status ───────────────────────────────────────────────
        net_zero = grid_import_kw < 0.5  # <0.5kW import = effectively net zero

        # ── Cumulative Stats ─────────────────────────────────────────────
        dt_h = self.speed / 60.0
        self._cumulative_solar_kwh += solar_kw * dt_h
        self._cumulative_load_kwh += smart_load_kw * dt_h
        self._cumulative_grid_import_kwh += grid_import_kw * dt_h

        # CO2 from grid import
        from co2 import get_emission_factor, get_tariff
        ef = get_emission_factor(hour_int)
        tariff = get_tariff(hour_int)
        self._cumulative_co2_kg += grid_import_kw * ef / 1000 * dt_h
        
        pf_data = power_factor_analysis(smart_load_kw, BUILDING_POWER_FACTOR, self.bess_kvar_compensation)

        return {
            "sim_hour": round(hour, 2),
            "sim_time_label": f"{hour_int:02d}:{int((hour % 1) * 60):02d}",
            "solar_kw": solar_kw,
            "smart_load_kw": smart_load_kw,
            "dumb_load_kw": round(dumb_load_kw, 2),
            "bess_kw": round(bess_kw, 2),
            "bess_soc_percent": round(self.bess_soc * 100, 1),
            "grid_import_kw": round(grid_import_kw, 2),
            "grid_export_kw": round(grid_export_kw, 2),
            "net_zero": net_zero,
            "power_factor": pf_data,
            "emission_factor_g_kwh": ef,
            "tariff_inr_kwh": tariff,
            "cumulative": {
                "solar_kwh": round(self._cumulative_solar_kwh, 2),
                "load_kwh": round(self._cumulative_load_kwh, 2),
                "grid_import_kwh": round(self._cumulative_grid_import_kwh, 2),
                "co2_kg": round(self._cumulative_co2_kg, 3)
            }
        }

    def get_24h_baseline_comparison(self) -> List[dict]:
        """Generate full 24-hour smart vs dumb profile for static charts."""
        result = []
        for h_int in range(24):
            hour = float(h_int)
            smart_load = building_load_kw(hour, is_smart=True)
            dumb_load = building_load_kw(hour, is_smart=False)
            solar = solar_power_kw(hour)
            from co2 import get_emission_factor, get_tariff
            result.append({
                "hour": h_int,
                "solar_kw": solar,
                "smart_load_kw": smart_load,
                "dumb_load_kw": dumb_load,
                "smart_grid_import": max(0, smart_load - solar),
                "dumb_grid_import": max(0, dumb_load - solar),
                "emission_factor": get_emission_factor(h_int),
                "tariff_inr_kwh": get_tariff(h_int),
            })
        return result
