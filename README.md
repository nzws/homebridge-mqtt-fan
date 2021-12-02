# @nzws/homebridge-mqtt-fan

## Install

```
npm install --global @nzws/homebridge-mqtt-fan
```

## Config

```json
{
  "accessory": "MQTTFan",
  "name": "Fan",
  "mqtt": {
    "host": "localhost",
    "port": 1883,
    "username": "",
    "password": ""
  },
  "degrees": {
    "off": [0],
    "on": [
      12,
      24
    ]
  }
}
```

- `mqtt`: MQTT Broker address.
- `degrees`: Set the angle for on/off