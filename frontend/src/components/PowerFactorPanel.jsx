import React, { useState } from 'react';
import { Activity, Zap } from 'lucide-react';

export default function PowerFactorPanel({ pfData }) {
  const [loading, setLoading] = useState(false);

  if (!pfData) return null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:8000/api/toggle-kvar', { method: 'POST' });
    } catch (e) {
      console.error("Failed to toggle kVAR compensation", e);
    }
    setLoading(false);
  };

  const isActive = pfData.kvar_compensation_active;
  const isPenalty = pfData.power_factor < 0.90;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.1)', borderRadius: 6, padding: 6 }}>
            <Activity size={15} />
          </div>
          <div>
            <p className="section-label">Power Factor & kVAR Penalty</p>
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Dynamic BESS VAR Compensation Engine
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className="btn"
          style={{
            background: isActive ? 'rgba(0,255,135,0.1)' : 'rgba(255,69,96,0.15)',
            border: `1px solid ${isActive ? '#00ff87' : 'rgba(255,69,96,0.5)'}`,
            color: isActive ? '#00ff87' : '#ff4560',
            display: 'flex', alignItems: 'center', gap: 6,
            animation: !isActive ? 'pulse-ring 2s infinite' : 'none',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          <Zap size={13} fill={isActive ? '#00ff87' : 'none'} />
          {isActive ? 'VAR INJECTION ON' : 'CLICK TO SOLVE PENALTY'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>REAL POWER (P)</p>
          <p style={{ fontSize: '1rem', fontFamily: 'JetBrains Mono', color: '#fff' }}>{pfData.real_kw} kW</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>APPARENT (S)</p>
          <p style={{ fontSize: '1rem', fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>{pfData.apparent_kva} kVA</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>REACTIVE (Q)</p>
          <p style={{ fontSize: '1rem', fontFamily: 'JetBrains Mono', color: isActive ? '#00ff87' : '#a855f7' }}>
            {pfData.reactive_kvar} kVAR
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>POWER FACTOR (cos φ)</p>
            <p style={{ fontSize: '1.2rem', fontFamily: 'JetBrains Mono', color: isPenalty ? '#ff4560' : '#00ff87', fontWeight: 600 }}>
              {pfData.power_factor.toFixed(3)}
            </p>
          </div>
          {isPenalty && (
            <div style={{ background: 'rgba(255,69,96,0.1)', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,69,96,0.3)' }}>
              <span style={{ fontSize: '0.65rem', color: '#ff4560', fontWeight: 700 }}>⚠️ DISCOM PENALTY</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>PENALTY SAVED / HR</p>
          <p style={{ fontSize: '1.1rem', fontFamily: 'JetBrains Mono', color: '#fff' }}>
            ₹{isActive ? (pfData.real_kw * 150 / 30 / 24).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>
      
      {isActive && (
        <div className="mt-3" style={{ fontSize: '0.68rem', color: '#00ff87', background: 'rgba(0,255,135,0.05)', padding: 8, borderRadius: 6, border: '1px border rgba(0,255,135,0.2)' }}>
          ✅ <strong>BESS Providing Capacitive Reactance:</strong> Inverter actively injecting leading kVAR to cancel inductive lagging loads. Discom penalty avoided.
        </div>
      )}
    </div>
  );
}
