export class ModbusRTU {
  constructor(port?: any);

  open(callback: Function): void;
  close(callback: Function): void;

  writeFC1(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadCoilResult>): void;
  writeFC2(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadCoilResult>): void;
  writeFC3(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadRegisterResult>): void;
  writeFC4(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadRegisterResult>): void;
  writeFC5(address: number, dataAddress: number, state: boolean, next: NodeStyleCallback<WriteCoilResult>): void;
  writeFC6(address: number, dataAddress: number, value: number, next: NodeStyleCallback<WriteRegisterResult>): void;

  writeFC15(address: number, dataAddress: number, states: Array<boolean>, next: NodeStyleCallback<WriteMultipleResult>): void;
  writeFC16(address: number, dataAddress: number, values: Array<number>, next: NodeStyleCallback<WriteMultipleResult>): void;

  readCoils(dataAddress: number, length: number): Promise<ReadCoilResult>;
  readDiscreteInputs(dataAddress: number, length: number): Promise<ReadCoilResult>;
  readHoldingRegisters(dataAddress: number, length: number): Promise<ReadRegisterResult>;
  readInputRegisters(dataAddress: number, length: number): Promise<ReadRegisterResult>;
  writeCoil(dataAddress: number, state: boolean): Promise<WriteCoilResult>;
  writeCoils(dataAddress: number, states: Array<boolean>): Promise<WriteMultipleResult>;
  writeRegister(dataAddress: number, value: number): Promise<WriteRegisterResult>;
  writeRegisters(dataAddress: number, values: Array<number>): Promise<WriteMultipleResult>; // 16

  isOpen: boolean;
}

export interface NodeStyleCallback<T> {
  (err: NodeJS.ErrnoException, param: T): void;
}

export interface ReadCoilResult {
  data: Array<boolean>;
  buffer: Buffer;
}

export interface ReadRegisterResult {
  data: Array<number>;
  buffer: Buffer;
}

export interface WriteCoilResult {
  address: number;
  state: boolean;
}

export interface WriteRegisterResult {
  address: number;
  value: number;
}

export interface WriteMultipleResult {
  address: number;
  length: number;
}

export interface SerialPortOptions {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
  rtscts?: boolean;
  xon?: boolean;
  xoff?: boolean;
  xany?: boolean;
  flowControl?: boolean | Array<string>;
  bufferSize?: number;
  parser?: any;
  platformOptions?: SerialPortUnixPlatformOptions;
}

export interface SerialPortUnixPlatformOptions {
  vmin?: number;
  vtime?: number;
}

export interface TcpPortOptions {
  port?: number;
  localAddress?: string;
  family?: number;
}

export interface UdpPortOptions {
  port?: number;
  localAddress?: string;
  family?: number;
}

export interface TcpRTUPortOptions {
  port?: number;
  localAddress?: string;
  family?: number;
}

export interface TelnetPortOptions {
  port?: number;
}

export interface C701PortOptions {
  port?: number;
}
