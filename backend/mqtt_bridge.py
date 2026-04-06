import os
import paho.mqtt.client as mqtt
import json
import logging

logger = logging.getLogger("optizero.mqtt")

class MQTTBridge:
    def __init__(self, broker="broker.hivemq.com", port=1883):
        self.broker = broker
        self.port = port
        self.client = mqtt.Client(client_id="optizero-server")
        
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
        # Real-time hardware override registers
        self.hardware_active = False
        self.hardware_solar_kw = None
        self.hardware_load_kw = None
        
    def connect_and_start(self):
        try:
            self.client.connect_async(self.broker, self.port, 60)
            self.client.loop_start() # Run background network loop
            logger.info(f"📡 MQTT Bridge connected to {self.broker}:{self.port}")
        except Exception as e:
            logger.error(f"MQTT connection failed: {e}")

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("Connected to public MQTT Broker! Listening for hardware...")
            client.subscribe("optizero/hardware/status")
            client.subscribe("optizero/hardware/solar_kw")
            client.subscribe("optizero/hardware/load_kw")
        else:
            logger.error(f"Bad connection score: {rc}")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode("utf-8")
        
        try:
            if topic == "optizero/hardware/status":
                # "1" = active, "0" = disconnected
                self.hardware_active = (payload == "1" or payload.lower() == "true")
                logger.info(f"Hardware Link: {'ONLINE' if self.hardware_active else 'OFFLINE'}")
                
            elif topic == "optizero/hardware/solar_kw":
                self.hardware_solar_kw = float(payload)
                self.hardware_active = True
                
            elif topic == "optizero/hardware/load_kw":
                self.hardware_load_kw = float(payload)
                self.hardware_active = True
                
        except ValueError:
            pass

mqtt_bridge = MQTTBridge()
