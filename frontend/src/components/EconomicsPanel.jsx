import { IndianRupee, TrendingUp, Battery, Receipt, Percent } from 'lucide-react';

function Row({ label, value, color, indent }) {
  return (
    <div className="data-row" style={{ paddingLeft: indent ? 12 : 0 }}>
      <span className="label" style={{ fontSize: indent ? '0.75rem' : '0.8rem', paddingLeft: indent ? 8 : 0, borderLeft: indent ? '2px solid rgba(255,255,255,0.08)' : 'none' }}>
        {label}
      </span>
      <span className="value" style={{ color: color || 'rgba(255,255,255,0.85)', fontSize: indent ? '0.82rem' : '0.88rem' }}>
        {value}
      </span>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: '12px 14px', marginBottom: 10,
    }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color }} />
        <p style={{ fontSize: '0.68rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function EconomicsPanel({ economics }) {
  if (!economics) {
    return (
      <div className="card p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>Loading economic analysis...</p>
      </div>
    );
  }

  const { capital_cost, lcoe, payback, battery_analysis, bill_comparison } = economics;

  const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
  const fmtK = (n) => n != null ? `₹${(n/100000).toFixed(2)}L` : '—';

  return (
    <div className="card card-glow-yellow p-4 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div style={{ color: '#ffd700', background: 'rgba(255,215,0,0.1)', borderRadius: 6, padding: 6 }}>
          <IndianRupee size={16} />
        </div>
        <div>
          <p className="section-label">[Deliverable 4] Economic Analysis</p>
          <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            LCOE · Payback · NPV · Battery Degradation
          </p>
        </div>
      </div>

      {/* LCOE Highlight */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))',
        border: '1px solid rgba(255,215,0,0.2)',
        borderRadius: 10, padding: '12px 14px',
      }}>
        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Levelized Cost of Energy (LCOE)
        </p>
        <div className="flex items-end gap-3 mt-1">
          <span className="metric-value" style={{ fontSize: '2rem', color: '#ffd700' }}>
            ₹{lcoe?.lcoe_inr_per_kwh ?? '—'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>/kWh</span>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>vs Grid Tariff</p>
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: '#00ff87' }}>
              ₹{lcoe?.vs_grid_tariff_inr_kwh}/kWh
            </p>
          </div>
        </div>
        <div className="progress-bar mt-2">
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.min(100, (lcoe?.lcoe_inr_per_kwh / lcoe?.vs_grid_tariff_inr_kwh) * 100)}%`,
              background: 'linear-gradient(90deg, #00ff87, #ffd700)',
            }}
          />
        </div>
        <p style={{ fontSize: '0.68rem', color: '#00ff87', marginTop: 4 }}>
          Saves ₹{lcoe?.savings_per_kwh_inr}/kWh vs grid
        </p>
        <p style={{ fontSize: '0.62rem', color: '#ffd700', marginTop: 6, opacity: 0.8 }}>Formula: (Σ Discounted CAPEX + OPEX) / Σ Discounted Energy (r=8%)</p>
      </div>

      {/* Capital Cost */}
      <Section icon={Receipt} title="Capital Investment" color="#00d4ff">
        <Row label="Solar Array (50 kW)" value={fmtK(capital_cost?.solar_array_cost_inr)} />
        <Row label="BESS (100 kWh LFP)" value={fmtK(capital_cost?.bess_cost_inr)} />
        <Row label="Inverter + Installation" value={fmtK((capital_cost?.inverter_cost_inr ?? 0) + (capital_cost?.installation_cost_inr ?? 0))} />
        <Row label="Total CAPEX" value={fmtK(capital_cost?.total_capex_inr)} color="#ffd700" />
      </Section>

      {/* Payback */}
      <Section icon={TrendingUp} title="Return on Investment" color="#00ff87">
        <Row label="Annual Savings" value={fmtK(payback?.annual_energy_savings_inr)} color="#00ff87" />
        <Row label="Ancillary Revenue" value={fmt(payback?.ancillary_revenue_inr_per_year)} color="#a855f7" indent />
        <Row label="Total Annual Benefit" value={fmtK(payback?.total_annual_savings_inr)} color="#00ff87" />
        <Row label="Payback Period" value={`${payback?.payback_years ?? '—'} years`} color="#ffd700" />
        <Row label="25-Year NPV" value={fmtK(payback?.npv_25yr_inr)} color="#00d4ff" />
      </Section>

      {/* Battery Degradation */}
      <Section icon={Battery} title="Smart Battery Lifecycle" color="#a855f7">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            { label: 'Naive Lifetime', value: `${battery_analysis?.naive_lifetime_years}yr`, color: '#ff4560' },
            { label: 'Opti-Zero Lifetime', value: `${battery_analysis?.optimized_lifetime_years}yr`, color: '#00ff87' },
          ].map((item) => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6, padding: '6px 10px',
            }}>
              <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{item.label}</p>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: '1rem', color: item.color, fontWeight: 700 }}>{item.value}</p>
            </div>
          ))}
        </div>
        <Row
          label="Replacement Cost Saved"
          value={fmt(battery_analysis?.savings_from_smart_cycling_inr)}
          color="#a855f7"
        />
      </Section>

      {/* Bill Comparison */}
      <Section icon={Percent} title="Monthly Bill Comparison" color="#ff4560">
        <Row label="Before (Grid Only)" value={fmt(bill_comparison?.baseline_monthly_bill_inr)} color="#ff4560" />
        <Row label="After (Opti-Zero)" value={fmt(bill_comparison?.optizero_monthly_bill_inr)} color="#00ff87" />
        <Row label="Monthly Savings" value={fmt(bill_comparison?.monthly_savings_inr)} color="#ffd700" />
        <Row label="Reduction" value={`${bill_comparison?.reduction_percent}%`} color="#00ff87" />
        <p style={{fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.3}}>* Incorporates unavoidable ₹4,500 TANGEDCO fixed demand charge. 100% of variable energy charges eliminated.</p>
      </Section>
    </div>
  );
}
