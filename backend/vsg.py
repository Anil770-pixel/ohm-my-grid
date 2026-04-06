"""
Virtual Synchronous Generator (VSG) Simulation
================================================
Implements the simplified Swing Equation to simulate a building BESS
acting as a Virtual Synchronous Generator — providing synthetic inertia
to stabilize grid frequency during faults.

Swing Equation: P_m - P_e = M * (dω/dt)
Simplified control law: P_BESS = K_D*(df/dt) + K_P*Δf

References:
- IEEE Std 1547-2018: Interconnection requirements
- Zhong & Weiss (2011): Synchronverter concept
"""

import math
import time
from dataclasses import dataclass, field
from typing import Optional

# ── VSG Parameters ────────────────────────────────────────────────────────────
F_NOMINAL = 50.0        # Hz — nominal grid frequency (India)
F_FAULT_TARGET = 49.5   # Hz — simulated fault frequency
F_DEADBAND = 0.05       # Hz — no response within ±0.05Hz (IEGC standard)

# Droop control coefficients
K_P = 8.0               # Proportional gain (kW/Hz)
K_D = 2.0               # Derivative gain (kW·s/Hz)
M_INERTIA = 4.0         # Virtual inertia constant (seconds)

BESS_MAX_KW = 30.0      # Maximum BESS discharge power (kW)
BESS_MIN_SOC = 0.15     # 15% minimum State of Charge (protect longevity)
BESS_MAX_SOC = 0.95     # 95% maximum State of Charge

# Recovery time constant (seconds)
RECOVERY_TAU = 8.0


@dataclass
class VSGState:
    """Real-time state of the Virtual Synchronous Generator."""
    frequency_hz: float = 50.0
    df_dt: float = 0.0              # Rate of Change of Frequency (RoCoF), Hz/s
    bess_injection_kw: float = 0.0
    bess_soc: float = 0.80          # State of Charge (0-1)
    is_fault_active: bool = False
    fault_start_time: Optional[float] = None
    inertia_active: bool = False
    total_energy_injected_kwh: float = 0.0
    ancillary_kw_available: float = BESS_MAX_KW
    prev_freq: float = 50.0


class VSGController:
    """
    Virtual Synchronous Generator Controller.

    Provides synthetic inertia response to grid frequency deviations,
    simulating the behavior of a large rotating generator for a BESS system.
    """

    def __init__(self):
        self.state = VSGState()
        self._fault_mode = False
        self._fault_time = 0.0
        self._natural_oscillation_phase = 0.0

    def inject_fault(self):
        """Trigger a simulated grid fault (frequency drop event)."""
        if not self._fault_mode:
            self._fault_mode = True
            self._fault_time = time.time()
            self.state.is_fault_active = True
            self.state.fault_start_time = self._fault_time

    def _natural_frequency_noise(self) -> float:
        """
        Generate realistic 50Hz grid micro-oscillations (±0.08Hz).
        Real grids always have small frequency deviations from load changes.
        """
        self._natural_oscillation_phase += 0.05
        noise = (
            0.03 * math.sin(self._natural_oscillation_phase * 0.7) +
            0.02 * math.sin(self._natural_oscillation_phase * 1.3) +
            0.01 * math.sin(self._natural_oscillation_phase * 2.9)
        )
        return noise

    def update(self, dt: float = 1.0) -> VSGState:
        """
        Step the VSG simulation by dt seconds.

        Returns updated VSGState with current frequency, BESS injection,
        and all relevant metrics.
        """
        state = self.state

        if self._fault_mode:
            elapsed = time.time() - self._fault_time

            if elapsed < 0.5:
                # Fault inception: rapid frequency drop (RoCoF ~ -1.5 Hz/s)
                freq_drop = min(elapsed * 3.0, F_NOMINAL - F_FAULT_TARGET)
                target_freq = F_NOMINAL - freq_drop

            elif elapsed < 2.0:
                # Nadir: frequency at lowest point
                target_freq = F_FAULT_TARGET + (elapsed - 0.5) * 0.05

            elif elapsed < 10.0:
                # VSG Recovery: exponential frequency recovery
                recovery_progress = (elapsed - 2.0) / RECOVERY_TAU
                target_freq = F_FAULT_TARGET + (F_NOMINAL - F_FAULT_TARGET) * (
                    1 - math.exp(-recovery_progress)
                )
            else:
                # Full recovery
                target_freq = F_NOMINAL
                self._fault_mode = False
                self.state.is_fault_active = False

        else:
            # Normal operation: micro-oscillations around 50Hz
            target_freq = F_NOMINAL + self._natural_frequency_noise()

        # Compute RoCoF (Rate of Change of Frequency)
        df_dt = (target_freq - state.prev_freq) / max(dt, 0.001)
        state.prev_freq = state.frequency_hz
        state.frequency_hz = target_freq
        state.df_dt = df_dt

        # ── VSG Control Law ──────────────────────────────────────────────────
        delta_f = F_NOMINAL - target_freq

        if abs(delta_f) > F_DEADBAND:
            # Activate synthetic inertia response: P_m - P_e = M(dw/dt)
            # Substituting: P_bess = M_INERTIA * |df/dt| + K_P * delta_f
            p_bess = (M_INERTIA * abs(df_dt)) + (K_P * delta_f)
            p_bess = max(0, min(p_bess, BESS_MAX_KW))

            # SOC constraint: don't discharge below minimum
            if state.bess_soc <= BESS_MIN_SOC:
                p_bess = 0
                state.inertia_active = False
            else:
                state.inertia_active = True
                # Deplete SOC proportionally
                energy_kwh = p_bess * dt / 3600
                state.bess_soc = max(BESS_MIN_SOC, state.bess_soc - energy_kwh / 100.0)
                state.total_energy_injected_kwh += energy_kwh
        else:
            p_bess = 0.0
            state.inertia_active = False

        state.bess_injection_kw = round(p_bess, 2)
        state.ancillary_kw_available = round(
            BESS_MAX_KW * (state.bess_soc - BESS_MIN_SOC) / (BESS_MAX_SOC - BESS_MIN_SOC), 1
        )

        return state

    def get_ancillary_revenue(self, hours_per_year: float = 4000) -> dict:
        """
        Calculate revenue from frequency regulation ancillary services.
        Assumes the VSG bids available BESS capacity into the ancillary market.
        """
        price_per_kwh = 0.15  # ₹/kWh (Indian SRAS market estimate)
        avg_available_kw = self.state.ancillary_kw_available
        # Revenue = Capacity × Hours Available × Performance Rate × Price
        annual_revenue = avg_available_kw * 8760 * 0.80 * price_per_kwh
        return {
            "available_kw": round(avg_available_kw, 1),
            "rate_inr_kwh": price_per_kwh,
            "annual_revenue_inr": round(annual_revenue, 0),
            "service_type": "Frequency Regulation (Primary Response)"
        }

    def to_dict(self) -> dict:
        s = self.state
        return {
            "frequency_hz": round(s.frequency_hz, 3),
            "df_dt_hz_per_s": round(s.df_dt, 4),
            "bess_injection_kw": s.bess_injection_kw,
            "bess_soc_percent": round(s.bess_soc * 100, 1),
            "is_fault_active": s.is_fault_active,
            "inertia_active": s.inertia_active,
            "total_energy_injected_kwh": round(s.total_energy_injected_kwh, 3),
            "ancillary_kw_available": s.ancillary_kw_available,
            "f_nominal": F_NOMINAL,
            "f_deadband": F_DEADBAND
        }
