"""
Opti-Zero GridSync — FastAPI Backend
=====================================
Real-time Digital Twin API with WebSocket streaming.

Endpoints:
  GET  /api/status       — Current system snapshot
  GET  /api/economics    — Full economic analysis
  GET  /api/baseline     — 24hr smart vs dumb schedule
  POST /api/inject-fault — Trigger VSG grid fault simulation
  WS   /ws/live-data     — Live stream (1 update/second)
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulator import BuildingSimulator
from vsg import VSGController
from economics import full_economic_summary
from co2 import daily_co2_summary
from mqtt_bridge import mqtt_bridge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("optizero")

# ── Singletons ─────────────────────────────────────────────────────────────────
simulator = BuildingSimulator(speed_minutes_per_second=2.0)
vsg = VSGController()
active_connections: Set[WebSocket] = set()

# ── Shared state cache ─────────────────────────────────────────────────────────
latest_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start MQTT Hardware Listener
    logger.info("📡 Starting IoT MQTT Bridge...")
    mqtt_bridge.connect_and_start()
    
    task = asyncio.create_task(simulation_loop())
    logger.info("🟢 Opti-Zero simulation loop started")
    yield
    task.cancel()
    logger.info("🔴 Simulation loop stopped")


async def simulation_loop():
    """
    Main async loop: step simulator + VSG, broadcast to all WS clients.
    Runs every 1 real-second.
    """
    global latest_state
    while True:
        try:
            sim_data = simulator.step()
        except Exception as step_error:
            logger.error(f"Simulator step error: {step_error}")
            import traceback
            traceback.print_exc()
            break
        
        try:
            vsg_data = vsg.update(dt=1.0)
        except Exception as vsg_error:
            logger.error(f"VSG update error: {vsg_error}")
            break

            payload = {
                **sim_data,
                "vsg": vsg.to_dict(),
                "mqtt_hardware_active": mqtt_bridge.hardware_active,
                "type": "live_update"
            }
            latest_state = payload

            if active_connections:
                message = json.dumps(payload)
                dead = set()
                for ws in active_connections:
                    try:
                        await ws.send_text(message)
                    except Exception:
                        dead.add(ws)
                active_connections -= dead

        except Exception as e:
            logger.error(f"Simulation error: {e}")

        await asyncio.sleep(1.0)


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Opti-Zero GridSync API",
    description="Active Microgrid Digital Twin — Net-Zero Building Controller",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ────────────────────────────────────────────────────────────

@app.get("/status")
async def get_status():
    """Current real-time system snapshot."""
    return latest_state if latest_state else {"status": "initializing"}


@app.get("/economics")
async def get_economics():
    """Full economic analysis: LCOE, payback, battery degradation."""
    return full_economic_summary()


@app.get("/baseline")
async def get_baseline():
    """24-hour comparison: smart (Opti-Zero) vs dumb scheduling."""
    hourly_data = simulator.get_24h_baseline_comparison()

    # Daily CO2 summary
    co2_input = [
        {
            "hour": row["hour"],
            "baseline_kw": row["dumb_grid_import"],
            "smart_kw": row["smart_grid_import"]
        }
        for row in hourly_data
    ]
    co2_summary = daily_co2_summary(co2_input)

    return {
        "hourly": hourly_data,
        "co2_summary": co2_summary
    }


@app.post("/inject-fault")
async def inject_fault():
    """Trigger a simulated grid frequency fault for VSG demo."""
    vsg.inject_fault()
    logger.info("⚡ Grid fault injected — VSG synthetic inertia activating")
    return {
        "success": True,
        "message": "Grid fault injected. Frequency dropping to 49.5 Hz. VSG activating BESS.",
    }


@app.post("/demo-mode")
async def set_demo_mode(mode: str):
    """Force simulator to specific scenarios for judge demonstration."""
    if mode == "solar_peak":
        simulator.sim_hour = 13.0  # 1 PM
        msg = "Solar Peak Mode (1:00 PM)"
    elif mode == "night_peak":
        simulator.sim_hour = 19.5  # 7:30 PM
        msg = "Night Peak Mode (7:30 PM)"
    else:
        return {"success": False, "message": "Unknown mode"}
    
    # Also reset SOC so the battery has enough charge to demo
    simulator.bess_soc = 0.85 
    
    logger.info(f"🎭 Demo Mode Activated: {msg}")
    return {"success": True, "message": f"Time shifted to {msg}"}


@app.post("/toggle-kvar")
async def toggle_kvar():
    """Engage/Disengage BESS inverter VAR compensation for PF correction."""
    simulator.bess_kvar_compensation = not simulator.bess_kvar_compensation
    msg = "Engaged" if simulator.bess_kvar_compensation else "Disengaged"
    logger.info(f"⚡ BESS Inverter kVAR Compensation {msg}")
    return {
        "success": True,
        "compensation_active": simulator.bess_kvar_compensation,
        "message": f"BESS kVAR Compensation {msg}"
    }


# ── WebSocket Endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/live-data")
async def websocket_endpoint(websocket: WebSocket):
    """
    Live data stream. Client receives JSON every 1 second with:
    - Solar generation, building load, BESS status
    - Grid frequency, VSG state
    - Net-zero status, emission factor, tariff
    """
    await websocket.accept()
    active_connections.add(websocket)
    client = websocket.client
    logger.info(f"🔌 WebSocket connected: {client}")

    try:
        # Send economics on connect (static, computed once)
        econ = full_economic_summary()
        await websocket.send_text(json.dumps({"type": "economics", **econ}))

        # Keep alive: listen for optional client commands (non-blocking with timeout)
        while True:
            try:
                # Wait for client message with timeout — this allows the connection
                # to stay open even if the client sends nothing (browser WS default)
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if msg == "inject-fault":
                    vsg.inject_fault()
                    await websocket.send_text(json.dumps({"type": "fault_ack"}))
            except asyncio.TimeoutError:
                # No message from client — that's fine, keep connection alive
                # Send a lightweight heartbeat ping
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break  # Connection is dead

    except WebSocketDisconnect:
        active_connections.discard(websocket)
        logger.info(f"🔌 WebSocket disconnected: {client}")
    except Exception as e:
        active_connections.discard(websocket)
        logger.error(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
