import {
  Chart as ChartJS, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { GitCompare } from 'lucide-react';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);

export default function BaselineComparison({ baselineData, co2Summary }) {
  const hourly = baselineData?.hourly ?? [];
  const co2 = co2Summary;

  const smartImport = HOURS.map((_, i) => hourly[i]?.smart_grid_import ?? 0);
  const dumbImport = HOURS.map((_, i) => hourly[i]?.dumb_grid_import ?? 0);
  const solarCurve = HOURS.map((_, i) => hourly[i]?.solar_kw ?? 0);

  const chartData = {
    labels: HOURS,
    datasets: [
      {
        label: 'Dumb Baseline (kW)',
        data: dumbImport,
        backgroundColor: 'rgba(255, 69, 96, 0.55)',
        borderColor: 'rgba(255, 69, 96, 0.9)',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'Opti-Zero Smart (kW)',
        data: smartImport,
        backgroundColor: 'rgba(0, 212, 255, 0.45)',
        borderColor: 'rgba(0, 212, 255, 0.9)',
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgba(255,255,255,0.6)',
          usePointStyle: true,
          font: { size: 11 },
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 16, 32, 0.95)',
        borderColor: 'rgba(0, 212, 255, 0.2)',
        borderWidth: 1,
        titleColor: 'rgba(255,255,255,0.7)',
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)} kW`,
          afterLabel: (ctx) => {
            if (ctx.datasetIndex !== 1) return '';
            const h = ctx.dataIndex;
            const tariff = hourly[h]?.tariff_inr_kwh ?? 0;
            const ef = hourly[h]?.emission_factor ?? 0;
            return [
              ` Tariff: ₹${tariff}/kWh`,
              ` CO₂: ${ef} gCO₂/kWh`
            ];
          }
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.25)',
          maxTicksLimit: 12,
          font: { size: 10, family: 'JetBrains Mono' },
        },
        border: { color: 'rgba(255,255,255,0.08)' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { size: 10, family: 'JetBrains Mono' },
          callback: (v) => `${v.toFixed(0)} kW`,
        },
        border: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  };

  const highlights = [
    { label: 'CO₂ Saved/Day', value: co2?.total_co2_saved_kg_per_day != null ? `${co2.total_co2_saved_kg_per_day} kg` : '—', color: '#00ff87' },
    { label: 'CO₂ Saved/Year', value: co2?.total_co2_saved_tons_per_year != null ? `${co2.total_co2_saved_tons_per_year} t` : '—', color: '#00ff87' },
    { label: 'Cost Saved/Year', value: co2?.total_cost_saved_inr_per_year != null ? `₹${Number(co2.total_cost_saved_inr_per_year).toLocaleString('en-IN')}` : '—', color: '#ffd700' },
    { label: 'Load Reduction', value: co2?.energy_reduction_percent != null ? `${co2.energy_reduction_percent}%` : '—', color: '#00d4ff' },
  ];

  return (
    <div className="card card-glow-blue p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.1)', borderRadius: 6, padding: 6 }}>
            <GitCompare size={16} />
          </div>
          <div>
            <p className="section-label">[Deliverable 2] Baseline Energy Comparison</p>
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              EV @ 6PM (dumb) vs EV @ 1PM + pre-cool @ 2PM (smart)
            </p>
          </div>
        </div>
      </div>

      <div style={{ height: 180 }}>
        <Bar data={chartData} options={options} />
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-4 gap-2">
        {highlights.map((h) => (
          <div key={h.label} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '8px 10px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
              {h.label}
            </p>
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.95rem', fontWeight: 700, color: h.color }}>
              {h.value}
            </p>
          </div>
        ))}
      </div>

      {/* Key insight */}
      <div style={{
        background: 'rgba(0,212,255,0.05)',
        border: '1px solid rgba(0,212,255,0.12)',
        borderRadius: 8, padding: '10px 12px',
        fontSize: '0.75rem', lineHeight: 1.6,
        color: 'rgba(255,255,255,0.5)',
      }}>
        <span style={{ color: '#00d4ff', fontWeight: 600 }}>Key Insight: </span>
        Dumb scheduling charges EVs at 6-8 PM (₹9.5/kWh, 820 gCO₂/kWh coal-heavy grid).
        Opti-Zero pre-charges at 1 PM (₹4.3/kWh, 240 gCO₂/kWh solar-dominant grid) — 
        saving both carbon and rupees by shifting load to low-emission solar hours.
      </div>
    </div>
  );
}
