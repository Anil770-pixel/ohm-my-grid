import { useState } from 'react';
import { ShieldAlert, Cpu, Leaf, TrendingDown, Zap } from 'lucide-react';

export default function VSGPanel({ vsgData, co2Data, onInjectFault }) {
  const [faultLoading, setFaultLoading] = useState(false);
  const [faultResult, setFaultResult] = useState(null);

  const handleFault = async () => {
    setFaultLoading(true);
    setFaultResult(null);
    try {
      const resp = await fetch('http://localhost:8000/api/inject-fault', { method: 'POST' });
      const json = await resp.json();
      setFaultResult(json);
      if (onInjectFault) onInjectFault();
    } catch (e) {
      setFaultResult({ success: false, message: 'Backend unreachable' });
    } finally {
      setFaultLoading(false);
    }
  };

  const isActive = vsgData?.inertia_active;
  const isFault = vsgData?.is_fault_active;

  return (
    <div className="card card-glow-green p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ color: '#a855f7', background: 'rgba(168,85,247,0.1)', borderRadius: 6, padding: 6 }}>
            <Cpu size={16} />
          </div>
          <p className="section-label">Virtual Synchronous Generator</p>
        </div>
        <span
          className="badge"
          style={{
            background: isActive ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
            color: isActive ? '#a855f7' : 'rgba(255,255,255,0.3)',
            border: `1px solid ${isActive ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <span className="pulse-dot" style={{ background: isActive ? '#a855f7' : 'rgba(255,255,255,0.3)' }} />
          {isActive ? 'INERTIA ACTIVE' : 'STANDBY'}
        </span>
      </div>

      {/* VSG Metrics */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Frequency', value: `${vsgData?.frequency_hz?.toFixed(3) ?? '—'} Hz`, color: isFault ? '#ff4560' : '#00ff87' },
          { label: 'RoCoF', value: `${vsgData?.df_dt_hz_per_s?.toFixed(3) ?? '—'} Hz/s`, color: '#ffd700' },
          { label: 'BESS Inject', value: `${vsgData?.bess_injection_kw?.toFixed(1) ?? '—'} kW`, color: '#a855f7' },
          { label: 'BESS SoC', value: `${vsgData?.bess_soc_percent?.toFixed(1) ?? '—'}%`, color: '#00d4ff' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8, padding: '8px 12px',
            }}
          >
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {item.label}
            </p>
            <p className="metric-value" style={{ fontSize: '1.1rem', color: item.color, marginTop: 3 }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Swing equation display */}
      <div style={{
        background: 'rgba(168,85,247,0.06)',
        border: '1px solid rgba(168,85,247,0.15)',
        borderRadius: 8, padding: '10px 12px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.5)',
        lineHeight: 1.7,
      }}>
        <span style={{ color: '#a855f7' }}>P_BESS</span> = K_D·(df/dt) + K_P·Δf
        <br />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>
          K_D=2.0  K_P=8.0  M=4.0s  f_deadband=±0.05Hz
        </span>
      </div>

      {/* CO2 Counter */}
      <div className="divider" />
      <p className="section-label mb-2" style={{ color: '#00ff87' }}>[Deliverable 3] CO₂ Reduction Estimator</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf size={14} style={{ color: '#00ff87' }} />
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>CO₂ Saved Today</span>
        </div>
        <span className="metric-value" style={{ fontSize: '1.3rem', color: '#00ff87' }}>
          {co2Data?.total_co2_saved_kg_per_day ?? '—'} kg
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Annual CO₂ Offset</span>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', color: '#00ff87' }}>
          {co2Data?.total_co2_saved_tons_per_year ?? '—'} tons/yr
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Load Reduction</span>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', color: '#00d4ff' }}>
          {co2Data?.energy_reduction_percent ?? '—'}%
        </span>
      </div>

      <div className="divider" />

      {/* Fault Injection */}
      <div>
        <p className="section-label mb-2">Fault Simulation</p>
        <button
          onClick={handleFault}
          disabled={faultLoading || isFault}
          className="fault-btn w-full py-2 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ShieldAlert size={15} />
          {faultLoading ? 'Injecting...' : isFault ? 'Fault Active — Recovering...' : '⚡ Inject Grid Fault (49.5 Hz)'}
        </button>
        {faultResult && (
          <p style={{
            fontSize: '0.68rem', marginTop: 6,
            color: faultResult.success ? '#00ff87' : '#ff4560',
            lineHeight: 1.4,
          }}>
            {faultResult.message}
          </p>
        )}
      </div>

      {/* Ancillary revenue note */}
      <div style={{
        background: 'rgba(0,212,255,0.05)',
        border: '1px solid rgba(0,212,255,0.12)',
        borderRadius: 8, padding: '8px 12px',
      }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown size={12} style={{ color: '#00d4ff' }} />
          <span style={{ fontSize: '0.65rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ancillary Services Revenue
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
          {vsgData?.ancillary_kw_available?.toFixed(1) ?? '—'} kW available for frequency regulation
          <br />
          <span style={{ color: '#00d4ff' }}>≈ ₹{(vsgData?.annual_revenue_inr ?? 25650).toLocaleString('en-IN')}/year</span>
        </p>
        <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          Formula: kW * 8760h * 80% * ₹0.15/kWh (CERC SRAS)
        </p>
      </div>
    </div>
  );
}
