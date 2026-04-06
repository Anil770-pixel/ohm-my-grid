import { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

export default function PowerChart({ solarHistory, loadHistory, gridHistory, labels }) {
  const len = labels.length;

  const data = {
    labels,
    datasets: [
      {
        label: 'Solar Gen (kW)',
        data: solarHistory,
        borderColor: '#ffd700',
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Building Load (kW)',
        data: loadHistory,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0, 212, 255, 0.06)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Grid Import (kW)',
        data: gridHistory,
        borderColor: '#ff4560',
        backgroundColor: 'rgba(255, 69, 96, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgba(255,255,255,0.6)',
          usePointStyle: true,
          pointStyle: 'line',
          boxWidth: 20,
          font: { size: 11, family: 'Inter' },
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
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)} kW`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.25)',
          maxTicksLimit: 8,
          font: { size: 10, family: 'JetBrains Mono' },
        },
        border: { color: 'rgba(255,255,255,0.08)' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.35)',
          font: { size: 10, family: 'JetBrains Mono' },
          callback: (v) => `${v.toFixed(0)} kW`,
        },
        border: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  };

  return (
    <div className="card card-glow-blue p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Power Balancing</p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            P_grid = P_load − (P_solar + P_BESS)
          </p>
        </div>
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE · {len}s
        </div>
      </div>
      <div style={{ height: 210, position: 'relative' }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
