import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

export default function FrequencyChart({ freqHistory, labels, isFault, vsGActive }) {
  const color = isFault ? '#ff4560' : vsGActive ? '#ffd700' : '#00ff87';

  const data = {
    labels,
    datasets: [
      {
        label: '50.00 Hz Reference',
        data: labels.map(() => 50.0),
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
      {
        label: 'Grid Frequency (Hz)',
        data: freqHistory,
        borderColor: color,
        backgroundColor: isFault ? 'rgba(255,69,96,0.08)' : 'rgba(0,255,135,0.06)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgba(255,255,255,0.5)',
          usePointStyle: true,
          pointStyle: 'line',
          boxWidth: 20,
          font: { size: 11 },
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 16, 32, 0.95)',
        borderColor: 'rgba(0, 255, 135, 0.2)',
        borderWidth: 1,
        titleColor: 'rgba(255,255,255,0.7)',
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex === 0) return ' Reference: 50.000 Hz';
            return ` Frequency: ${ctx.parsed.y?.toFixed(3)} Hz`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.2)',
          maxTicksLimit: 8,
          font: { size: 10, family: 'JetBrains Mono' },
        },
        border: { color: 'rgba(255,255,255,0.08)' },
      },
      y: {
        min: 49.4,
        max: 50.15,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { size: 10, family: 'JetBrains Mono' },
          callback: (v) => `${v.toFixed(2)} Hz`,
          stepSize: 0.1,
        },
        border: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  };

  return (
    <div
      className="card p-4 flex flex-col gap-3"
      style={{
        borderColor: isFault ? 'rgba(255,69,96,0.3)' : 'rgba(0,255,135,0.15)',
        boxShadow: isFault
          ? '0 0 30px rgba(255,69,96,0.12)'
          : '0 0 20px rgba(0,255,135,0.05)',
        transition: 'all 0.4s ease',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Grid Frequency — Synthetic Inertia</p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            VSG swing: P_BESS = K_D·(df/dt) + K_P·Δf
          </p>
        </div>
        <span
          className="badge"
          style={{
            background: isFault ? 'rgba(255,69,96,0.15)' : 'rgba(0,255,135,0.1)',
            color: isFault ? '#ff4560' : '#00ff87',
            border: `1px solid ${isFault ? 'rgba(255,69,96,0.4)' : 'rgba(0,255,135,0.3)'}`,
          }}
        >
          <span
            className="pulse-dot"
            style={{ background: isFault ? '#ff4560' : '#00ff87' }}
          />
          {isFault ? 'FAULT DETECTED' : vsGActive ? 'VSG RESPONDING' : 'STABLE'}
        </span>
      </div>
      <div style={{ height: 210, position: 'relative' }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
