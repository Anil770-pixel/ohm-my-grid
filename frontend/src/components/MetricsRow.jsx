import { Zap, Sun, Building2, Activity, Wifi, WifiOff } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, unit, color, badge, subtext, glow }) {
  const colorMap = {
    blue: { text: '#00d4ff', bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.2)' },
    green: { text: '#00ff87', bg: 'rgba(0,255,135,0.1)', border: 'rgba(0,255,135,0.2)' },
    red: { text: '#ff4560', bg: 'rgba(255,69,96,0.1)', border: 'rgba(255,69,96,0.2)' },
    yellow: { text: '#ffd700', bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.2)' },
    purple: { text: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      className="card p-4 flex flex-col gap-2"
      style={{ borderColor: c.border, boxShadow: `0 0 20px ${c.bg}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ color: c.text, background: c.bg, borderRadius: 6, padding: 6 }}>
            <Icon size={16} />
          </div>
          <span className="section-label">{label}</span>
        </div>
        {badge && (
          <span
            className="badge"
            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
          >
            <span className="pulse-dot" style={{ background: c.text }} />
            {badge}
          </span>
        )}
      </div>

      <div style={{ color: c.text }}>
        {value !== undefined ? (
          <span className="metric-value" style={{ fontSize: '2.2rem' }}>
            {value}
          </span>
        ) : (
          <span className="metric-value" style={{ fontSize: '2.2rem', color: 'rgba(255,255,255,0.2)' }}>—</span>
        )}
        {unit && (
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </div>

      {subtext && (
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function MetricsRow({ data, connected }) {
  const solar = data?.solar_kw;
  const load = data?.smart_load_kw;
  const freq = data?.vsg?.frequency_hz;
  const netZero = data?.net_zero;
  const bess = data?.vsg?.bess_soc_percent;
  const gridImport = data?.grid_import_kw;

  const freqColor = freq === undefined ? 'blue'
    : freq >= 49.9 ? 'green'
    : freq >= 49.7 ? 'yellow'
    : 'red';

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Net-Zero Status */}
      <MetricCard
        icon={Zap}
        label="[Deliverable 1] Net-Zero Logic"
        value={netZero === undefined ? '—' : netZero ? 'NET ZERO' : 'GRID DEP.'}
        color={netZero ? 'green' : netZero === false ? 'red' : 'blue'}
        badge={netZero ? 'ACHIEVED' : netZero === false ? 'IMPORTING' : '—'}
        subtext={gridImport != null ? `Grid import: ${gridImport.toFixed(1)} kW` : 'Awaiting data...'}
      />

      {/* Solar */}
      <MetricCard
        icon={Sun}
        label="Solar Generation"
        value={solar?.toFixed(1) ?? '—'}
        unit="kW"
        color="yellow"
        badge="LIVE"
        subtext={`BESS SoC: ${bess?.toFixed(1) ?? '—'}%`}
      />

      {/* Load */}
      <MetricCard
        icon={Building2}
        label="Building Load"
        value={load?.toFixed(1) ?? '—'}
        unit="kW"
        color="blue"
        badge={data?.power_factor ? `PF ${data.power_factor.power_factor.toFixed(2)}` : 'LIVE'}
        subtext={
          data?.power_factor
            ? `Apparent: ${data.power_factor.apparent_kva.toFixed(1)} kVA | Q: ${data.power_factor.reactive_kvar.toFixed(1)} kVAR`
            : 'Power factor analysis ready'
        }
      />

      {/* Grid Frequency */}
      <MetricCard
        icon={Activity}
        label="Grid Frequency"
        value={freq?.toFixed(3) ?? '—'}
        unit="Hz"
        color={freqColor}
        badge={
          data?.vsg?.is_fault_active ? 'FAULT!' :
          data?.vsg?.inertia_active ? 'VSG ACTIVE' :
          connected ? 'STABLE' : 'OFFLINE'
        }
        subtext={
          data?.vsg?.inertia_active
            ? `BESS injecting ${data.vsg.bess_injection_kw.toFixed(1)} kW synthetic inertia`
            : `Emission: ${data?.emission_factor_g_kwh ?? '—'} gCO₂/kWh`
        }
      />
    </div>
  );
}
