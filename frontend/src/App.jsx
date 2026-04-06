import { useState, useRef, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Network, RefreshCw } from 'lucide-react';
import { useLiveData, appendToHistory, makeTimestampLabels } from './hooks/useWebSocket';
import MetricsRow from './components/MetricsRow';
import PowerChart from './components/PowerChart';
import FrequencyChart from './components/FrequencyChart';
import VSGPanel from './components/VSGPanel';
import PowerFactorPanel from './components/PowerFactorPanel';
import EconomicsPanel from './components/EconomicsPanel';
import BaselineComparison from './components/BaselineComparison';

const MAX_HIST = 60;

export default function App() {
  // ── Live Data State ─────────────────────────────────────────────────────
  const [liveData, setLiveData] = useState(null);
  const [economics, setEconomics] = useState(null);
  const [baselineData, setBaselineData] = useState(null);
  const [co2Summary, setCo2Summary] = useState(null);
  const [connected, setConnected] = useState(false);

  // ── Rolling History for Charts ──────────────────────────────────────────
  const [solarHist, setSolarHist] = useState([]);
  const [loadHist, setLoadHist] = useState([]);
  const [gridHist, setGridHist] = useState([]);
  const [freqHist, setFreqHist] = useState([]);
  const [labels, setLabels] = useState([]);
  const tickRef = useRef(0);

  // ── Live Data Handler (called every second by polling hook) ────────────────
  const onUpdate = useCallback((data) => {
    setConnected(true);
    setLiveData(data);
    setSolarHist(prev => appendToHistory(prev, data.solar_kw ?? 0, MAX_HIST));
    setLoadHist(prev => appendToHistory(prev, data.smart_load_kw ?? 0, MAX_HIST));
    setGridHist(prev => appendToHistory(prev, data.grid_import_kw ?? 0, MAX_HIST));
    setFreqHist(prev => appendToHistory(prev, data.vsg?.frequency_hz ?? 50.0, MAX_HIST));
    setLabels(makeTimestampLabels(MAX_HIST));
    tickRef.current += 1;
  }, []);

  useLiveData(onUpdate, 1000);

  // Detect connection loss: if no update for 3s, mark disconnected
  const lastUpdateRef = useRef(Date.now());
  useEffect(() => {
    if (connected) lastUpdateRef.current = Date.now();
  }, [connected, liveData]);

  useEffect(() => {
    const checker = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 4000) setConnected(false);
    }, 2000);
    return () => clearInterval(checker);
  }, []);

  // ── Load Baseline Data (once) ───────────────────────────────────────────
  useEffect(() => {
    fetch('http://localhost:8000/api/baseline')
      .then(r => r.json())
      .then(data => {
        setBaselineData(data);
        setCo2Summary(data.co2_summary);
      })
      .catch(console.error);

    fetch('http://localhost:8000/api/economics')
      .then(r => r.json())
      .then(setEconomics)
      .catch(console.error);
  }, []);

  const isFault = liveData?.vsg?.is_fault_active ?? false;
  const vsGActive = liveData?.vsg?.inertia_active ?? false;
  const simTime = liveData?.sim_time_label ?? '--:--';

  return (
    <div className="app-container">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 style={{
            fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #00d4ff, #00ff87)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            ⚡ OPTI-ZERO GRIDSYNC
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: '0.08em' }}>
            ACTIVE MICROGRID DIGITAL TWIN · NET-ZERO BUILDING CONTROLLER
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Sim Clock */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <RefreshCw size={12} style={{ color: '#00d4ff', animation: 'spin 4s linear infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: '#00d4ff' }}>
              SIM {simTime}
            </span>
          </div>

          {/* Connection badge */}
          <div
            className="badge"
            style={{
              background: connected ? 'rgba(0,255,135,0.1)' : 'rgba(255,69,96,0.1)',
              color: connected ? '#00ff87' : '#ff4560',
              border: `1px solid ${connected ? 'rgba(0,255,135,0.3)' : 'rgba(255,69,96,0.3)'}`,
              fontSize: '0.72rem', padding: '5px 12px',
            }}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'BACKEND LIVE' : 'CONNECTING...'}
          </div>

          {/* MQTT Hardware Link Badge */}
          <div
            className="badge"
            style={{
              background: liveData?.mqtt_hardware_active ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
              color: liveData?.mqtt_hardware_active ? '#a855f7' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${liveData?.mqtt_hardware_active ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
              fontSize: '0.72rem', padding: '5px 12px',
            }}
          >
            <Network size={12} />
            {liveData?.mqtt_hardware_active ? 'MQTT SENSOR OVERRIDE' : 'MATH SIMULATION'}
          </div>

          {/* Fault alert */}
          {isFault && (
            <div className="badge badge-red" style={{ animation: 'pulse-ring 0.8s ease-in-out infinite', fontSize: '0.72rem', padding: '5px 12px' }}>
              ⚡ GRID FAULT — VSG RESPONDING
            </div>
          )}

          {/* Demo Controls */}
          <div className="flex gap-2">
            <button onClick={() => fetch('http://localhost:8000/api/demo-mode?mode=solar_peak', {method:'POST'})} className="badge" style={{cursor: 'pointer', background: 'rgba(255,215,0,0.1)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.4)', padding: '5px 12px'}}>☀️ Solar Peak</button>
            <button onClick={() => fetch('http://localhost:8000/api/demo-mode?mode=night_peak', {method:'POST'})} className="badge" style={{cursor: 'pointer', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.4)', padding: '5px 12px'}}>🌙 Night Peak</button>
            <button onClick={() => window.print()} className="badge" style={{cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '5px 12px'}}>🖨️ Print Report</button>
          </div>
        </div>
      </header>

      {/* ── Metrics Row ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <MetricsRow data={liveData} connected={connected} />
      </div>

      {/* ── Main 3-Column Grid ───────────────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 320px' }}>

        {/* Column 1: Power Charts */}
        <div className="flex flex-col gap-3 animate-in delay-1">
          <PowerChart
            solarHistory={solarHist}
            loadHistory={loadHist}
            gridHistory={gridHist}
            labels={labels}
          />
          <FrequencyChart
            freqHistory={freqHist}
            labels={labels}
            isFault={isFault}
            vsGActive={vsGActive}
          />
          <BaselineComparison
            baselineData={baselineData}
            co2Summary={co2Summary}
          />
        </div>

        {/* Column 2: Economics */}
        <div className="animate-in delay-2">
          <EconomicsPanel economics={economics} />
        </div>

        {/* Column 3: VSG + VPP */}
        <div className="flex flex-col gap-3 animate-in delay-3">
          <PowerFactorPanel pfData={liveData?.power_factor} />
          
          <VSGPanel
            vsgData={liveData?.vsg}
            co2Data={co2Summary}
          />

          {/* VPP Scalability Card */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div style={{ color: '#a855f7', background: 'rgba(168,85,247,0.1)', borderRadius: 6, padding: 6 }}>
                <Network size={15} />
              </div>
              <p className="section-label">[Deliverable 5] Future Scalability: VPP</p>
            </div>
            {[
              { n: '1', label: 'Building', desc: 'This app — local Net-Zero control', color: '#00d4ff' },
              { n: '100', label: 'Buildings', desc: 'P2P energy trading mesh', color: '#a855f7' },
              { n: '1,000', label: 'Nodes', desc: 'City-wide Virtual Power Plant', color: '#00ff87' },
              { n: '10,000', label: 'IoT Nodes', desc: 'Sell ancillary services to grid operator', color: '#ffd700' },
            ].map((step, i) => (
              <div key={i} className="flex gap-3 mb-3 last:mb-0">
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: `rgba(${step.color === '#00d4ff' ? '0,212,255' : step.color === '#a855f7' ? '168,85,247' : step.color === '#00ff87' ? '0,255,135' : '255,215,0'},0.15)`,
                  border: `1px solid ${step.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: step.color, fontWeight: 700,
                }}>
                  {String(i + 1)}
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: step.color }}>
                    {step.n} {step.label}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Bottom Information Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 animate-in delay-3">
        {/* Tech Stack badge */}
        <div className="card p-3">
          <p className="section-label mb-2">Technology Stack</p>
          {[
            ['FastAPI', 'Python backend · WebSockets', '#00d4ff'],
            ['React + Vite', 'Frontend · real-time charts', '#ffd700'],
            ['VSG Algorithm', 'Swing equation · droop control', '#a855f7'],
            ['MQTT-ready', 'ESP32 / Arduino HIL bridge', '#00ff87'],
          ].map(([name, desc, color]) => (
            <div key={name} className="flex items-center gap-2 mb-2 last:mb-0">
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
                boxShadow: `0 0 6px ${color}`,
              }} />
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{name}</span>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Regulatory Compliance */}
        <div className="card p-3">
          <p className="section-label mb-2" style={{color: '#00d4ff'}}>Regulatory Compliance</p>
          <div style={{fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5}}>
            <p><span style={{color: '#00d4ff'}}>CERC IEGC 2023:</span> Freq Band 49.90–50.05 Hz</p>
            <p><span style={{color: '#00d4ff'}}>CERC Ancillary:</span> ESS Eligible for SRAS (2022)</p>
            <p><span style={{color: '#00d4ff'}}>LCOE Standard:</span> CERC 8% Discount Rate (25yr)</p>
          </div>
        </div>

        {/* Code Snippets */}
        <div className="card p-3">
          <p className="section-label mb-2" style={{color: '#a855f7'}}>Backend Core Physics (vsg.py)</p>
          <pre style={{
            background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4, 
            fontSize: '0.62rem', color: '#00ff87', fontFamily: 'JetBrains Mono', overflowX: 'auto'
          }}>
{`# Line 137: Swing Equation
p_bess = (M * abs(df_dt)) + (K_P * delta_f)

# Line 167: CERC SRAS Revenue (₹)
rev = kW * 8760 * 0.80 * 0.15`}
          </pre>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        marginTop: 16, textAlign: 'center',
        fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.08em',
      }}>
        <div className="flex justify-center gap-4 mb-3 mt-4">
            <span style={{background: 'rgba(255,215,0,0.05)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.2)', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold'}}>SDG 7: Clean Energy</span>
            <span style={{background: 'rgba(0,212,255,0.05)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold'}}>SDG 11: Sustainable Cities</span>
            <span style={{background: 'rgba(0,255,135,0.05)', color: '#00ff87', border: '1px solid rgba(0,255,135,0.2)', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold'}}>SDG 13: Climate Action</span>
        </div>
        OPTI-ZERO GRIDSYNC © 2025 · NET-ZERO BUILDING DIGITAL TWIN · VIRTUAL SYNCHRONOUS GENERATOR CONTROL
      </footer>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
