import { API, HAP, Logging, AccessoryConfig, Service, Characteristic } from 'homebridge';
import mqtt, { Client } from 'mqtt';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('MQTTFan', MQTTFan);
};

class MQTTFan {
  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly api: API;
  private readonly Service;
  private readonly Characteristic;

  private readonly active: Characteristic;
  private readonly rotationSpeed: Characteristic;

  private readonly informationService: Service;
  private readonly service: Service;

  private readonly client: Client;

  private currentActive = false;
  private currentSpeed = 1;

  /**
   * REQUIRED - This is the entry point to your plugin
   */
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.service = new hap.Service.Fanv2(config.name);

    // create handlers for required characteristics
    this.active = this.service.getCharacteristic(this.Characteristic.Active)
      .onGet(this.handleActiveGet.bind(this))
      .onSet(this.handleActiveSet.bind(this));

    this.rotationSpeed = this.service.getCharacteristic(this.Characteristic.RotationSpeed)
      .onGet(this.handleRotationSpeedGet.bind(this))
      .onSet(this.handleRotationSpeedSet.bind(this));

    this.informationService = new this.Service.AccessoryInformation()
      .setCharacteristic(this.Characteristic.Manufacturer, 'nzws.me')
      .setCharacteristic(this.Characteristic.Model, 'MQTT Fan')
      .setCharacteristic(this.Characteristic.SerialNumber, 'hb-mqtt-fan');

    const { mqtt: { host = 'localhost', port = 1883, username, password } } = this.config;
    this.client = mqtt.connect(`mqtt://${host}:${port}`, {
      username,
      password,
    });

    this.client.subscribe('main_switch');
    this.updateStatus();

    this.client.on('message', topic => {
      this.log.debug(topic);

      switch (topic) {
        case 'main_switch':
          return this.switcher();
      }
    });
  }

  /**
   * REQUIRED - This must return an array of the services you want to expose.
   * This method must be named "getServices".
   */
  getServices() {
    return [this.informationService, this.service];
  }

  handleActiveGet() {
    const { INACTIVE, ACTIVE } = this.Characteristic.Active;

    return this.currentActive ? ACTIVE : INACTIVE;
  }

  handleRotationSpeedGet() {
    return this.getLevelToPercent(this.currentSpeed);
  }

  handleActiveSet(value) {
    try {
      const { ACTIVE } = this.Characteristic.Active;

      this.updateStatus(value === ACTIVE);
    } catch (e) {
      this.log.error('handleActiveSet', e);
    }
  }

  handleRotationSpeedSet(value) {
    try {
      this.updateStatus(this.currentActive, this.getPercentToLevel(value));
    } catch (e) {
      this.log.error('handleRotationSpeedSet', e);
    }
  }

  private updateStatus(nextActive = this.currentActive, nextSpeed = this.currentSpeed): void {
    const { degrees: { off, on } } = this.config;

    const degree = nextActive ? on[nextSpeed - 1] : off;

    this.client.publish('update', degree.toString());

    const { INACTIVE, ACTIVE } = this.Characteristic.Active;
    this.currentActive = nextActive;
    this.active.updateValue(nextActive ? ACTIVE : INACTIVE);

    this.currentSpeed = nextSpeed;
    this.rotationSpeed.updateValue(this.getLevelToPercent(nextSpeed));
  }

  private getLevelToPercent(level: number): number {
    const length = this.config.degrees.on.length;
    const percent = Math.floor(level * (100 / length));

    return Math.max(0, Math.min(100, percent));
  }

  private getPercentToLevel(percent: number): number {
    const length = this.config.degrees.on.length;
    const level = Math.ceil(percent / (100 / length));

    return Math.max(1, Math.min(length, level));
  }

  private switcher(): void {
    const onLength = this.config.degrees.on.length;

    // オフ: オン,1
    // オン (n != max): オン,n+1
    // オン (n == max): オフ

    if (!this.currentActive) {
      return this.updateStatus(true, 1);
    }

    if (onLength <= this.currentSpeed) {
      return this.updateStatus(false);
    }

    return this.updateStatus(true, this.currentSpeed + 1);
  }
}
