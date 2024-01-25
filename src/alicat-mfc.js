// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED 'AS IS.' JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var EventEmitter = require('events')
const ad = require('./abstract-driver.js')

/**
All the error code meanings that Alicat documents for their controllers.
*/

// var errorCodes = {
//   ADC: 'Internal communication error (not common – requires repair at factory)',
//   EXH: 'Manual exhaust valve override (max drive on downstream valve)',
//   HLD: 'Valve drive hold is active (bypass active PID control)',
//   LCK: 'Membrane button lockout is active (see command codes below)',
//   MOV: 'Mass flow rate overage (outside measurable range including uncalibrated range)',
//   VOV: 'Volumetric flow rate overage (outside measurable range including uncalibrated range)',
//   POV: 'Pressure reading overage (outside measurable range including uncalibrated range)',
//   TOV: 'Temperature reading overage (outside measurable range)',
//   OVR: 'Totalizer has rolled over at least once or frozen at max value',
//   TMF: 'Totalizer missed some flow data (due to MOV or VOV error)',
//   OPL: 'Over pressure limit has been activated',
// }

/**
All the commands that Alicat documents for communicating with one of their controllers.
They encompass more than the commands necessary to communicate with just an MFC.
<br>Refer to the code to see how the object is built.
*/

var commands = {
  FrameFormat: {args: ['id'], format: ['id', '??D*'], Description: 'Queries the data frame format (multi-line response)'},
  MFRGinfo: {args: ['id'], format: ['id', '??M*'], Description: 'Queries the manufacturing information (multi-line response)'},
  AllGases: {args: ['id'], format: ['id', '??G*'], Description: 'Queries all installed gases (multi-line response)'},
  Firmware: {args: ['id'], format: ['id', 'VE'], Description: 'Queries the installed firmware revision number'},
  DataFrame: {args: ['id'], format: ['id'], Description: 'Query/Poll a single data frame'},
  SetNewID: {args: ['oldID', 'newID'], format: ['oldID', '@=', 'newID'], Description: 'Set unit ‘A’ to have the new unit ID of ‘B’'},
  SetStreaming: {args: ['id'], format: ['id', '@=@'], Description: 'Set unit ‘A’ to data streaming mode'},
  StopStreaming: {args: ['id'], format: ['*@=', 'id'], Description: 'Set the streaming device back to polling mode with the unit ID ‘A’'},
  ReadRegister: {args: ['id', 'number'], format: ['id', 'R', 'number'], Description: 'Read contents of register number [#]'},
  WriteRegister: {args: ['id', 'number', 'value'], format: ['id', 'W', 'number', '=', 'value'], Description: 'Write a new value [x] to register number [#]'},
  SendSPInCounts: {args: ['id', 'number'], format: ['id', 'number'], Description: 'Send a new setpoint in counts as defined by register 24'},
  SendSetpoint: {args: ['id', 'int', 'dec'], format: ['id', 'S', 'int', '.', 'dec'], Description: 'Send a new setpoint value [floating point value in selected engineering units] AG[x] Change gas type (by assigned number)'},
  TareFlow: {args: ['id'], format: ['id', 'V'], Description: 'Volumetric flow tare (subsequently tares mass flow as well, if applicable)'},
  TarePressure: {args: ['id'], format: ['id', 'P'], Description: 'Pressure tare (gauge and differential pressure units only)'},
  TarePressureAbs: {args: ['id'], format: ['id', 'PC'], Description: 'Absolute pressure tare against internal barometer (if installed)'},
  ResetTotalizer: {args: ['id'], format: ['id', 'T'], Description: 'Reset totalizer (if installed)'},
  HoldValve: {args: ['id'], format: ['id', 'H'], Description: 'Same as AHP (for single valve controllers) or AHC (for dual valve controllers)'},
  HoldValveClosed: {args: ['id'], format: ['id', 'HC'], Description: 'Hold valve(s) closed'},
  HoldValveCurPos: {args: ['id'], format: ['id', 'HP'], Description: 'Hold valve(s) at current position'},
  ExhaustValve: {args: ['id'], format: ['id', 'E'], Description: 'Exhaust valve open, inlet valve closed (dual valve controllers only)'},
  CancelHolds: {args: ['id'], format: ['id', 'C'], Description: 'Continue close loop control (cancel any hold conditions)'},
  LockButtons: {args: ['id'], format: ['id', 'L'], Description: 'Lock display buttons (ignores button presses only if they would cause a change)'},
  UnlockButtons: {args: ['id'], format: ['id', 'U'], Description: 'Unlock display buttons'},
  PressureLimit: {args: ['id', 'int', 'dec'], format: ['id', 'OPL', 'int', '.', 'dec'], Description: 'Set upper pressure limit [floating point value in selected engineering units]'},
  ReadP: {args: ['id'], format: ['id', 'R21'], Description: 'Reads proportion register'},
  ReadI: {args: ['id'], format: ['id', 'R22'], Description: 'Reads integral register'},
  ReadD: {args: ['id'], format: ['id', 'R23'], Description: 'Reads derivative register'},
  SetP: {args: ['id', 'value'], format: ['id', 'W21=', 'value'], Description: 'Sets proportion register'},
  SetI: {args: ['id', 'value'], format: ['id', 'W22=', 'value'], Description: 'Sets integral register'},
  SetD: {args: ['id', 'value'], format: ['id', 'W23=', 'value'], Description: 'Sets derivative register'},
  SetGas: {args: ['id', 'value'], format: ['id', 'W125=', 'value'], Description: 'Sets gas register'},
}

var universalCommands = ['FrameFormat', 'MFRGinfo', 'AllGases', 'DataFrame']

/**
Effectively a hash table of what the frameFormat serial response gives (the keys)
and the object properties (the values)

<br>key = parsed return from FrameFormat command
<br>alue = DeviceMFC.property
*/

var linkerKey = {
  new: {
    'Unit ID': 'unitID',
    'Abs Press': 'pressure',
    'Flow Temp': 'temperature',
    'Volu Flow': 'volumeFlow',
    'Mass Flow': 'massFlow',
    'Mass Flow Setpt': 'setPoint',
    Gas: 'gas',
    '*Error': 'status',
  },
  '4v29': {
    'Unit ID': 'unitID',
    Pressure: 'pressure',
    Temperature: 'temperature',
    Volumetric: 'volumeFlow',
    Mass: 'massFlow',
    SetPoint: 'setPoint',
    Gas: 'gas',
    Error: 'status',
  },
  GP: {
    Identifier: 'unitID',
    Pressure: 'pressure',
    Temperature: 'temperature',
    Volumetric: 'volumeFlow',
    Mass: 'massFlow',
    SetPoint: 'setPoint',
    Gas: 'gas',
    Error: 'status',
  },
}

// the index of parser fields corresponds to the location in the dataframe of
// different properties of the DeviceMFC object

/**
 * Represents a data point
 * @constructor
 * @param {string} value - The value of the data point (Default NaN)
 * @param {string} units - The units of the data point (Default '')
 * @param {number} time - The time of the data point (Default Date.now())

 * @property {string} value - The value of the data point (Default NaN)
 * @property {string} units - The units of the data point (Default '')
 * @property {number} time - The time of the data point (Default Date.now())
 */

// class DataPoint {
//   constructor({value=0, units='', time}) {
//     this.value = value
//     this.units = units
//     this.time = ((time === undefined) ? Date.now() : time)
//   }
// }

/**
 * Represents an Alicat Mass Flowcontroller Device, providing entirely
 * asynchronous access to different properties. What this means is that each
 * property read will instantly return the result of the last serial line read,
 * and dispatch the proper serial line command to update that property.
 * @constructor
 * @param {string} id - The ID of the MFC (A-Z) (Default 'A')
 * @param {Router} router - A Router Class object representing the serial port (optional)
 * @param {boolean} testFlag - Flag denoting wether or not to actually use serial port (Default false)
 * @param {number} setPoint - What to intiailize the setpoint of the MFC to (optional)
 * @param {string} processVariable - What variable the pid algorithm watches (optional) (currently, unimplemented)
 *
 * @property {ad.DataPoint} massFlow - The mass flow
 * @property {ad.DataPoint} volumeFlow - The volumetric flow
 * @property {ad.DataPoint} gas - The gas the controller is set to
 * @property {ad.DataPoint} pressure - The absolute pressure of the flow
 * @property {ad.DataPoint} temperature - The temperature of the flow
 * @property {ad.DataPoint} setPoint - The set-point for the MFC
 * @property {ad.DataPoint} status - The status of the MFC (for error codes)
 * @property {PIDobject} pid - Object containing proportion, integral, and derivative coefficients {p, i, d}
 * @property {string} revision - The firmware revision of the MFC
 * @property {Map} gasList - All the pre-programmed gases the MFC knows
 * @property {ad.DataPoint} p - The proportion coefficient for the pid
 * @property {ad.DataPoint} i - The integral coefficient for the pid
 * @property {ad.DataPoint} d - The derivative coefficient for the pid
 * @property {string} id - The ID of the MFC (A-Z)
 * @property {number} router - The router the MFC is using
 * @property {boolean} testFlag - Flag denoting wether or not to actually use serial port
 * @property {number} timeout - The timout
 * @property {Array} resp - The single-line response from the MFC over the serial line
 * @property {Map} frameRepeat - Prevents multiple serial-line requests for successive properties by taking advantage of the data-frame from the MFC
 * @property {Map} property - Class-internal map of all the properties accessed with get/set functions
 * @property {string} processVariable - What variable the pid algorithm watches (currently, unimplemented)
 *
 *
 */

class DeviceMFC extends EventEmitter {
  constructor({id = 'A',
    router,
    testFlag,
    // setPoint,
    processVariable,
    debugTest,
    maxRefreshInterval = 1000,
  }) {
    super()
    this.oldGP = false
    this.id = id

    this.testFlag = testFlag
    if (testFlag === undefined) this.testFlag = false
    this.debugTest = debugTest
    if (debugTest === undefined) this.debugTest = false

    this.router = router
    this.timeout = 200 // ms

    this.frameRepeat = new Map()

    this.property = new Map()
    this.property.set('unitID', new ad.DataPoint({value: ''}))
    this.property.set('massFlow', new ad.DataPoint({}))
    this.property.set('volumeFlow', new ad.DataPoint({}))
    this.property.set('gas', new ad.DataPoint({value: ''}))
    this.property.set('pressure', new ad.DataPoint({}))
    this.property.set('temperature', new ad.DataPoint({}))
    this.property.set('gasList', new Map())
    this.property.set('p', new ad.DataPoint({}))
    this.property.set('i', new ad.DataPoint({}))
    this.property.set('d', new ad.DataPoint({}))
    this.property.set('setPoint', new ad.DataPoint({}))
    this.property.set('status', new ad.DataPoint({value: ''}))
    this.property.set('firmware', '')

    this.lockRefreshInterval = false
    this.maxRefreshInterval = maxRefreshInterval
    this.lastReadTime = {}
    this.lastReadTime.unitID = Date.now()
    this.lastReadTime.massFlow = Date.now()
    this.lastReadTime.volumeFlow = Date.now()
    this.lastReadTime.gas = Date.now()
    this.lastReadTime.pressure = Date.now()
    this.lastReadTime.temperature = Date.now()
    this.lastReadTime.gasList = Date.now()
    this.lastReadTime.p = Date.now()
    this.lastReadTime.i = Date.now()
    this.lastReadTime.d = Date.now()
    this.lastReadTime.setPoint = Date.now()
    this.lastReadTime.status = Date.now()
    this.lastReadTime.firmware = Date.now()

    // FS = full-scale
    this.FS = new Map()
    this.FS.set('massFlow', 0)
    this.FS.set('volumeFlow', 0)
    this.FS.set('pressure', 0)
    this.loopVar = 'massFlow'

    if (this.testFlag) {
      this.parserFields = [
        'unitID',
        'pressure',
        'temperature',
        'volumeFlow',
        'massFlow',
        'setPoint',
        'gas',
        'status',
      ]
      this.parseRawGasList(['A  G00  Air ', 'A  G02  N2 ', 'A  G03  O2 '])
    } else {
      this.parserFields = []
    }
    this.totalizer = false // assume no totalizer
    this.pressureController = false
    this.bidirectional = false // assume uni-directional

    this.processVariable = processVariable
    this.serialControl = new ad.SerialControl({
      router: this.router,
      testFlag: this.testFlag,
      timeout: this.timeout,
      debugTest: true,
      trimNulls: true,
    })
  }

  convertToPercentFS() {
    if (this.bidirectional) {
      return 0
    }
    // uni-directional
    // for now, assume setpoint is percent of FS
    var percentFS = this.property.get('setPoint').value / this.FS.get(this.loopVar) * 100 // /this.fullScale

    if (this.oldGP) {
      if (percentFS > 102.4) {
        percentFS = 102.4
        this.property.set('setpoint', percentFS)
      }
    } else {
      if (percentFS > 125) {
        percentFS = 125
        this.property.set('setpoint', percentFS)
      }
    }

    return percentFS * 640
  }

  async sendSetPoint() {
    var stringSP = this.property.get('setPoint').value.toString()
    var spParts = stringSP.split('.')
    var intPart = spParts[0]

    var decPart
    if (spParts[1]) {
      decPart = spParts[1].slice(0, 3) // limit to 3 decimal places
    } else {
      decPart = '0'
    }
    var command
    if (this.revisionNumber <= 432) {
      var percentValue = Math.round(this.convertToPercentFS())
      if (isNaN(percentValue)) {
        percentValue = 0
      }
      command = this.commandString('WriteRegister', {id: this.id, number: 24, value: percentValue.toString()})
    } else {
      command = this.commandString('SendSetpoint', {id: this.id, int: intPart, dec: decPart})
    }
    if (this.debugTest) console.log('sending setpoint')
    if (this.debugTest) console.log(command)
    // var sp
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
    } catch (error) {
      console.log(error)
      return error
    }
    if (this.debugTest) console.log('setpoint resp')
    if (this.debugTest) console.log(resp)
    if (this.revisionNumber <= 432) {
      // fancy stuff to get sp
    } else {
      this.parseFrame(resp, time)
    }
    return
  }

  get setPoint() {
    if (this.debugTest) console.log('get setpoint')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.setPoint <= this.maxRefreshInterval) {
      return this.property.get('setPoint')
    } else {
      this.lastReadTime.setPoint = Date.now()
    }

    if (this.frameRepeat.get('setPoint') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('setPoint', 1)
    } else {
      if (this.frameRepeat.get('setPoint') === 0) {
        this.frameRepeat.set('setPoint', 1)
      } else {
        this.frameRepeat.set('setPoint', 0)
      }
    }
    return this.property.get('setPoint')
  }

  set setPoint(sp) {
    this.property.get('setPoint').value = sp
    this.sendSetPoint().catch(error => console.log(error))
  }

  parseRegResp(resp) {
    var splitResp = resp[0].split('=')
    var lastPart = splitResp[splitResp.length - 1].trim()
    return parseInt(lastPart, 10)
  }

  async getP() {
    var command = this.commandString('ReadP', {id: this.id})
    var p
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
      if (this.debugTest) console.log(resp)
      if (resp) {
        p = this.parseRegResp(resp)
        this.property.get('p').value = p
        this.property.get('p').time = time
      }
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  async getI() {
    var command = this.commandString('ReadI', {id: this.id})
    var i
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
      if (this.debugTest) console.log(resp)
      if (resp) {
        i = this.parseRegResp(resp)
        this.property.get('i').value = i
        this.property.get('i').time = time
      }
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  async getD() {
    var command = this.commandString('ReadD', {id: this.id})
    var d
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command, false)
      time = Date.now()
      if (this.debugTest) console.log(resp)
      if (resp) {
        d = this.parseRegResp(resp)
        this.property.get('d').value = d
        this.property.get('d').time = time
      }
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  async setP(p) {
    var command = this.commandString('SetP', {id: this.id, value: p})
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command)
      time = Date.now()
      if (resp) {
        resp = this.parseRegResp(resp)
        this.property.get('p').value = resp
        this.property.get('p').time = time
      }
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  async setI(i) {
    var command = this.commandString('SetI', {id: this.id, value: i})
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command)
      time = Date.now()
      if (this.debugTest) console.log(resp)
      if (resp) {
        resp = this.parseRegResp(resp)
        this.property.get('i').value = resp
        this.property.get('i').time = time
      }
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  async setD(d) {
    var command = this.commandString('SetD', {id: this.id, value: d})
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command)
      time = Date.now()
      if (this.debugTest) console.log(resp)
      if (resp) {
        resp = this.parseRegResp(resp)
        this.property.get('d').value = resp
        this.property.get('d').time = time
      }
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  /**
  Wrapper function for this.getP(), this.getI(), and this.getD()
  */
  async getPID() {
    try {
      await this.getP()
      await this.getI()
      await this.getD()
    } catch (error) {
      console.log(error)
    }
  }

  get pid() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.p <= this.maxRefreshInterval) {
      return {
        p: this.property.get('p').value,
        i: this.property.get('i').value,
        d: this.property.get('d').value,
      }
    } else {
      this.lastReadTime.p = Date.now()
    }

    this.getPID().catch(error => console.log(error))
    return {
      p: this.property.get('p').value,
      i: this.property.get('i').value,
      d: this.property.get('d').value,
    }
  }

  set pid({p, i, d}) {
    if (p !== undefined) {
      this.setP(p).catch(error => console.log(error))
    }
    if (i !== undefined) {
      this.setI(i).catch(error => console.log(error))
    }
    if (d !== undefined) {
      this.setD(d).catch(error => console.log(error))
    }
  }

  /**
  Checks to see if another frame property has been requested. If not, it will
  return true, meaning that the driver should send the serial command. On the other
  hand, if another frame property has been requested, it will return false, meaning
  that the code should just return what is already stored in DeviceMFC.property
  */

  noRecentRequests() {
    var sum = 0
    this.frameRepeat.forEach(value => {
      sum += value
    })
    if (sum === 0) {
      // there have been no recent requests
      return true
    } else {
      return false
    }
  }

  /**
  Clears the frameRepeat map, so that a call to DeviceMFC.noRecentRequests() will return true.
  */

  clearRecentRequests() {
    this.frameRepeat.forEach((value, key, map) => {
      map.set(key, 0)
    })
  }

  /**
  This function converts the rawGasList into a map within DeviceMFC.property.get('gasList').
  <br>The map entries are the numbers (e.g. 'G00')
  <br>The map values are the gas short descriptions (e.g. 'Air')
  @param {string[]} rawGasList - What is returned from querying the device's gas-list
  */

  parseRawGasList(rawGasList) {
    var splitLine
    var entry
    var value
    rawGasList.forEach(line => {
      splitLine = line.split(/[ ]+/)
      entry = splitLine[1].trim()
      entry = entry.slice(1)
      if (this.oldGP) {
        value = splitLine[3].trim()
      } else {
        value = splitLine[2].trim()
      }

      if (this.debugTest) console.log('Entry: ' + entry + ' value: ' + value)
      this.property.get('gasList').set(entry, value)
    })
  }

  /**
  Gets the gas list from the device
  */

  async getGasList() {
    if (this.pressureController) {
      return
    }

    var command = this.commandString('AllGases', {id: this.id})
    var rawGasList
    try {
      rawGasList = await this.serialControl.serial(command, true)
    } catch (error) {
      console.log(error)
      return error
    }
    if (!this.testFlag && rawGasList !== undefined) {
      this.parseRawGasList(rawGasList)
    }
    return
  }

  get gasList() {
    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.gasList <= this.maxRefreshInterval) {
      return this.property.get('gasList')
    } else {
      this.lastReadTime.gasList = Date.now()
    }

    this.getGasList().catch(error => console.log(error))
    return [...this.property.get('gasList').values()]
  }

  set gasList(val) {
    // this.property.get('gasList').value = val
  }

  /**
  Returns the lengths of the tokenized parts of a line split by ' '
  <br>This is the first of a series of functions used to clean up and parse what is returned
  from the 'FrameFormat' (see {@linkcode commands}) serial command.
  @param {string} line - The first line returned from 'FrameFormat'
  */

  getCellLengths(line) {
    var elements = line.split(' ')
    var lengths = []
    elements.forEach((element, index) => {
      lengths[index] = element.length
    })
    return lengths
  }

  /**
  Uses the lengths of the lines as determined previously to slice up and trim
  the rest of the lines returned from 'FrameFormat' (see {@linkcode commands}) serial command
  @param {string} line - Any but the first line returned from 'FrameFormat'
  @param {number[]} lengths - An array containing the lengths of each field
  */

  parseFFLine(line, lengths) {
    var splitLine = []
    var start = 0
    var end = 0
    console.log('lengths')
    console.log(lengths)
    for (var i = -1; i < lengths.length - 1; i++) {
      if (i < 0) {
        start = 0
      } else {
        start = end + 1
      }
      end = start + lengths[i + 1]

      splitLine.push(line.slice(start, end).trim())
    }
    console.log('splitLine')
    console.log(splitLine)
    return splitLine
  }

  findLinker() {
    if (this.oldGP) {
      return linkerKey.GP
    } else {
      // go through revisions
      if (this.revisionNumber <= 429) {
        return linkerKey['4v29']
      } else {
        return linkerKey.new
      }
    }
  }

  linkFS(parserField, strArray) {
    if (!this.FS.has(parserField)) {
      return
    }
    if (this.revisionNumber <= 429) {
      var strFS = strArray[strArray.length - 3]
      this.FS.set(parserField, Number(strFS))
      console.log('Full-scale')
      console.log(parserField)
      console.log(strFS)
      console.log(Number(strFS))
    }
  }

  /**
  Once the results of 'FrameFormat' (see {@linkcode commands}) have been cleaned up, the code can use
  the {@linkcode linkerKey} to add the proper fields to DeviceMFC.parserFields and
  DeviceMFC.frameRepeat.
  <br>Since 'FrameFormat' also provides the units for each field, these are added to their respective
  properties in DeviceMFC.property.get().units
  */

  link(strArray) {
    // links str with class property
    var linker = this.findLinker()

    if (linker[strArray[3]] !== undefined) {
      this.parserFields.push(linker[strArray[3]])
      this.frameRepeat.set(linker[strArray[3]], 0)
      // add units
      // strArray[7] contains the units as the last space-delimited field
      var splitNotes
      console.log('strArray')
      console.log(strArray)
      if (this.oldGP) {
        splitNotes = strArray[7].split(' ')
      } else {
        splitNotes = strArray[strArray.length - 1].split(' ')
      }
      console.log('splitNotes')
      console.log(splitNotes)
      var lastFieldIndex = this.parserFields.length - 1
      if (this.property.has(this.parserFields[lastFieldIndex])) {
        // console.log(this.property.get(this.parserFields[this.parserFields.length-1]))
        if (splitNotes[splitNotes.length - 1] !== 'ADC') {
          var units = splitNotes[splitNotes.length - 1]
          this.property.get(this.parserFields[lastFieldIndex]).units = (units === 'na' || units === '_' ? '' : units)
          this.linkFS(this.parserFields[lastFieldIndex], strArray)
        }
      } else {
        console.log('UNKNOWN PROPERTY:')
        console.log('Field:')
        console.log(this.parserFields[this.parserFields.length - 1])
        console.log('All properties')
        console.log(this.property)
      }
    }
  }

  /**
  Parses the response from 'FrameFormat' (see {@linkcode commands}).
  <br>Calls necessary functions to clean up the text, match it, and adjust
  certain properties of DeviceMFC, specifically parserFields, frameRepeat, and
  propert.get().units
  @param {string[]} resp - The raw response from the device for the command 'FrameFormat'
  */

  parseFrameFormat(resp) {
    var lengths = this.getCellLengths(resp[0])
    // console.log(lengths)
    // console.log(this.property.get('unitID'))
    for (var i = 1; i < resp.length; i++) {
      // this.parseFFLine(resp[i], lengths)
      this.link(this.parseFFLine(resp[i], lengths))
    }
    // console.log(this.parserFields)
    // console.log(this.property)
    console.log(this.frameRepeat)
  }

  /**
  Gets the dataframe from the device
  */

  async getDataFrame() {
    var command = this.commandString('DataFrame', {id: this.id})
    var resp
    var time
    try {
      resp = await this.serialControl.serial(command, false, 80)
      time = Date.now()
    } catch (error) {
      console.log('data frame error')
      console.log(error)
      return error
    }
    this.parseFrame(resp, time)
    if (this.frameRepeatTimer !== undefined) {
      clearTimeout(this.frameRepeatTimer)
    }
    this.frameRepeatTimer = setTimeout(() => {
      this.clearRecentRequests()
    }, this.timeout * 3)
    return
  }

  /**
  Gets the dataframe format from the device and then parses it {@linkcode parseFrameFormat}
  */

  async getFrameFormat() {
    var command = this.commandString('FrameFormat', {id: this.id})
    var resp
    try {
      resp = await this.serialControl.serial(command, true)
      if (this.debugTest) console.log(resp)
      if (resp) this.parseFrameFormat(resp)
    } catch (error) {
      console.log(error)
      return error
    }
    return
  }

  get pressure() {
    if (this.debugTest) console.log('get pressure')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.pressure <= this.maxRefreshInterval) {
      return this.property.get('pressure')
    }
    this.lastReadTime.pressure = Date.now()

    if (this.frameRepeat.get('pressure') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('pressure', 1)
    } else {
      if (this.frameRepeat.get('pressure') === 0) {
        this.frameRepeat.set('pressure', 1)
      } else {
        this.frameRepeat.set('pressure', 0)
      }
    }
    return this.property.get('pressure')
  }

  set pressure(val) {
    this.property.get('pressure').value = val
    this.property.get('pressure').time = Date.now()
  }

  get temperature() {
    if (this.debugTest) console.log('get temperature')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.temperature <= this.maxRefreshInterval) {
      return this.property.get('temperature')
    } else {
      this.lastReadTime.temperature = Date.now()
    }

    if (this.frameRepeat.get('temperature') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('temperature', 1)
    } else {
      if (this.frameRepeat.get('temperature') === 0) {
        this.frameRepeat.set('temperature', 1)
      } else {
        this.frameRepeat.set('temperature', 0)
      }
    }
    return this.property.get('temperature')
  }

  set temperature(val) {
    this.property.get('temperature').value = val
    this.property.get('temperature').time = Date.now()
  }

  get volumeFlow() {
    if (this.debugTest) console.log('get volumeFlow')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.volumeFlow <= this.maxRefreshInterval) {
      return this.property.get('volumeFlow')
    } else {
      this.lastReadTime.volumeFlow = Date.now()
    }

    if (this.frameRepeat.get('volumeFlow') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('volumeFlow', 1)
    } else {
      if (this.frameRepeat.get('volumeFlow') === 0) {
        this.frameRepeat.set('volumeFlow', 1)
      } else {
        this.frameRepeat.set('volumeFlow', 0)
      }
    }
    return this.property.get('volumeFlow')
  }

  set volumeFlow(val) {
    this.property.get('volumeFlow').value = val
    this.property.get('volumeFlow').time = Date.now()
  }

  get massFlow() {
    if (this.debugTest) console.log('get massflow')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.massFlow <= this.maxRefreshInterval) {
      return this.property.get('massFlow')
    } else {
      this.lastReadTime.massFlow = Date.now()
    }

    if (this.frameRepeat.get('massFlow') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('massFlow', 1)
    } else {
      if (this.frameRepeat.get('massFlow') === 0) {
        this.frameRepeat.set('massFlow', 1)
      } else {
        this.frameRepeat.set('massFlow', 0)
      }
    }
    return this.property.get('massFlow')
  }

  set massFlow(val) {
    this.property.get('massFlow').value = val
    this.property.get('massFlow').time = Date.now()
  }

  get status() {
    if (this.debugTest) console.log('get status')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.status <= this.maxRefreshInterval) {
      return this.property.get('status')
    } else {
      this.lastReadTime.status = Date.now()
    }

    if (this.frameRepeat.get('status') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('status', 1)
    } else {
      if (this.frameRepeat.get('status') === 0) {
        this.frameRepeat.set('status', 1)
      } else {
        this.frameRepeat.set('status', 0)
      }
    }
    return this.property.get('status')
  }

  set status(val) {
    this.property.get('status').value = val
    this.property.get('status').time = Date.now()
  }

  get gas() {
    if (this.debugTest) console.log('get gas')
    if (this.debugTest) console.log(this.frameRepeat)

    if (this.lockRefreshInterval && Date.now() - this.lastReadTime.gas <= this.maxRefreshInterval) {
      return this.property.get('gas')
    } else {
      this.lastReadTime.gas = Date.now()
    }

    if (this.frameRepeat.get('gas') === 1 || this.noRecentRequests()) {
      this.getDataFrame().catch(error => console.log(error))
      this.clearRecentRequests()
      this.frameRepeat.set('gas', 1)
    } else {
      if (this.frameRepeat.get('gas') === 0) {
        this.frameRepeat.set('gas', 1)
      } else {
        this.frameRepeat.set('gas', 0)
      }
    }
    return this.property.get('gas')
  }

  /**
  Returns the gas number corresponding to a particular gas based off the gas-list
  @param {string} gasString - Short name of gas corresponding to Alicat's standard
  // TODO: use actual for loop to decrease needless checks
  */

  getGasNumber(gasString) {
    var ret

    this.property.get('gasList').forEach((entry, value) => {
      // console.log(entry+' '+gasString)
      // console.log(value)
      if (entry === gasString) {
        // console.log(value.slice(1))
        ret = value
        // console.log(ret)
        return ret // NOTE: This return doesn't actually do anything
      }
    })
    return ret
  }

  /**
  Sets the gas that device should be configured for
  @param {string} gasString - Short name of gas corresponding to Alicat's standard
  */

  async setGas(gasString) {
    // return new Promise((resolve, reject) => {
    var time
    var resp
    var gasNumber
    try {
      gasNumber = this.getGasNumber(gasString)
      if (gasNumber === undefined) {
        console.log('Unknown Gas')
        return
      }
      var command = this.commandString('SetGas', {id: this.id, value: gasNumber})
      resp = await this.serialControl.serial(command, false, 200)
      time = Date.now()
      if (!this.testFlag) {
        // only parse a response if we're not testing
        gasNumber = this.parseRegResp(resp)
      }
    } catch (error) {
      console.log(error)
      // reject(error)
      return
    }
    // console.log('gasNumber: '+gasNumber)
    // console.log('gas ID: '+this.property.get('gasList').get(gasNumber))
    if (gasNumber) {
      this.property.get('gas').value = this.property.get('gasList').get(gasNumber)
      this.property.get('gas').time = time
    }
    // resolve()
    // })
  }

  set gas(gasString) {
    this.setGas(gasString).catch(error => console.log(error))
  }

  trimNulls(line) {
    return line.replace(/\x00/g, '')
  }

  /**
  Parses a dataframe line response from the device. Fields are split with this
  regex /[ ]+/

  DeviceMFC.prototype.parserFields are used to parse the tokenized line
  @param {string[]} line - Single-element string array. Example ['A +014.80 +022.90 +00.000 +00.000 +00.000     N2']
  @param {number} frameTime - result of Date.now() (milliseconds)
  */

  parseFrame(line, frameTime) {
    if (line === undefined) {
      line = ['A -01.0 -01.0 -01.000 -01.000 -01.000     N2']
    }
    // line[0] = this.trimNulls(line[0])
    console.log(line)
    var tokenizedFrame = line[0].split(/[ ]+/)
    // console.log(tokenizedFrame)
    this.parserFields.forEach((field, index) => {
      if (tokenizedFrame[index] !== undefined) {
        if (typeof this.property.get(field).value === 'number') {
          this.property.get(field).value = parseFloat(tokenizedFrame[index])
        } else {
          this.property.get(field).value = tokenizedFrame[index]
        }

        this.property.get(field).time = frameTime
      }
    })
  }

  /*
  Gets the firmware from the device (doesn't parse the string response)
  */

  async getFirmware() {
    // return new Promise(async (resolve, reject) => {
    var command
    if (this.oldGP) {
      command = this.commandString('MFRGinfo', {id: this.id})
    } else {
      command = this.commandString('Firmware', {id: this.id})
    }

    var firmware
    try {
      firmware = await this.serialControl.serial(command, true, 1000)
    } catch (error) {
      console.log(error)
      console.log('Testing for old GP firmware')
      if (this.oldGP) {
        throw error
      } else {
        this.oldGP = true
        return this.getFirmware()
      }
    }
    console.log('firmware')
    console.log(firmware)
    this.assignFirmware(firmware)
    this.assignPartNumber(firmware)
    return
  }

  assignPartNumber(firmware) {
    if (firmware === undefined) {
      this.partNumber = 'undefined'
      return
    }
    var partNumberLineParts
    if (this.oldGP) {
      if (firmware.length > 4) {
        var partNumberLine = firmware[4]
        partNumberLineParts = partNumberLine.split(/[ ]+/)
        this.partNumber = partNumberLineParts[4]
      }
    } else {
      this.partNumber = ''
    }

    console.log(partNumberLineParts)
    if (this.partNumber.substring(0, 2) === 'PC') {
      this.pressureController = true
    }
  }

  assignFirmware(firmware) {
    if (firmware === undefined) {
      this.property.set('firmware', 'undefined')
      this.revisionNumber = 0
      return
    }
    if (this.oldGP) {
      this.property.set('firmware', firmware.slice(-1)[0])
    } else {
      this.property.set('firmware', firmware[0])
    }
    var firmStr = this.property.get('firmware')
    var firmStrParts = firmStr.split(/[ ]+/)
    if (this.oldGP) {
      if (firmStrParts.length > 4) {
        this.property.set('firmware', firmStrParts[4])
      }
      this.revisionNumber = 0
    } else {
      if (firmStrParts.length > 1) {
        this.property.set('firmware', firmStrParts[1])
        var majorMinor = this.property.get('firmware').slice(0, 4) // e.g. 4v29
        majorMinor = majorMinor.replace('v', '')
        this.revisionNumber = Number(majorMinor)
      }
    }
    // console.log(firmStrParts)
  }

  get revision() {
    this.getFirmware().catch(error => console.log(error))
    return this.property.get('firmware')
  }

  /**
  Currently, unimplemented
   */

  getManufacturingInfo() {
    // var command = this.commandString('MFRGinfo', {id: this.id})
    // console.log(command)
    // if (!this.testFlag) {
    //   // console.log('This is not a test')
    //   this.router.port.write(command)
    // }
  }

  /**
   * Initializes a device:
   * 1. Gets the firmware version (doesn't currently do anything with it, but should in the future)
   * 2. Gets the frame format, and builds the parser from that format
   * 3. Gets the gas list
   * 4. Sends the intiailization setpoint to the controller (0 if that argument isn't defined)
   * 5. Gets P, I, and D for DeviceMFC.pid
   * 6. Gets a data frame to fill in initial values for the other properties
   * @param {number} setPoint - optional argument that defines the initailization setpoint for the MFC
   * @fires DeviceMFC#initialized
   */

  async initialize() {
    // get firmware version
    try {
      await this.getFirmware()
      await this.getFrameFormat()
      await this.getGasList()

      // ideally, would like to be able to iterate over undefined values and set them,
      // but using massFlow and pid accomplishes the same end, albeit not very
      // elegantly
      await this.getP()
      await this.getI()
      await this.getD()
      if (this.debugTest) console.log('alicat initialization')
      if (this.debugTest) console.log(this.frameRepeat)
      await this.getDataFrame()
      this.clearRecentRequests()
      if (this.debugTest) console.log('done intiailizing')
      /**
       * Initialized event. Fired when the device has finished intiailizing
       * (getting firmware, gas list, pid, temperature, pressure, flow, and
       * and generating the frame parser from the frameformat command)
       *
       * @event DeviceMFC#initialized
       */
      this.emit('initialized')
      return
    } catch (error) {
      this.parserFields = [
        'unitID',
        'pressure',
        'temperature',
        'volumeFlow',
        'massFlow',
        'setPoint',
        'gas',
        'status',
      ]
      this.parseRawGasList(['A  G00  Air ', 'A  G02  N2 ', 'A  G03  O2 '])
      console.log(error)
      this.emit('initialized')
      throw error
    }
  }

  reinitialize({id}) {
    if (id) {
      var newID = id.match(/[A-Z]/g)
      if (newID !== null) {
        this.id = newID[0]
      }
    }
    this.initialize()
  }

  /**
  Generates the serial line command based off the short-description and the proper
  arguments.
  @param {string} shortDescription - The short description of a serial line command (e.g. 'DataFrame')
  @param {object} args - The appropriate argument object for a given serial line command (e.g. {id: 'A'} for 'DataFrame')
  */

  commandString(shortDescription, args) {
    var cmdString
    // console.log(typeof commands)
    if (Object.prototype.hasOwnProperty.call(commands, shortDescription)) {
      commands[shortDescription].args.forEach(function (arg) {
        if (args) {
          if (!Object.prototype.hasOwnProperty.call(args, arg)) {
            console.log('Missing argument: ' + arg)
            return
          }
        } else {
          console.log('Missing 2nd argument')
          return
        }
      })
    } else {
      console.log('Unknown Short Description: ' + shortDescription)
      console.log('Available Short Descriptions')
      Object.entries(commands).forEach(([key, value]) => {
        if (this.debugTest) console.log(value)
        if (this.debugTest) console.log(key + '\t\t' + value.Description)
        if (this.debugTest) console.log('args:')
        value.args.forEach(arg => {
          if (this.debugTest) console.log(arg)
        })
      })
      return
    }
    cmdString = ''
    if (this.debugTest) console.log('Building cmd string')
    commands[shortDescription].format.forEach((item, i) => {
      // console.log(i)
      if (Object.prototype.hasOwnProperty.call(args, item)) {
        // replace item with argument
        if (this.debugTest) console.log('Replacing')
        cmdString = cmdString.concat(args[item])
        if (i === 0 && this.oldGP && !universalCommands.includes(shortDescription)) {
          cmdString = cmdString.concat('$$')
        }
      } else {
        // leave item
        // console.log('Leaving')
        cmdString = cmdString.concat(item)
      }
    })
    cmdString = cmdString.concat('\r')

    if (this.debugTest) console.log(cmdString)

    return cmdString
  }
}

module.exports = {
  Device: DeviceMFC,
  commandString: DeviceMFC.commandString,
}

// for software-only testing
// var router = new Router('', true)
// var devA = new DeviceMFC({id:'A',router: router,testFlag: true})
// console.log(devA)
// console.log(devA.setPoint)
// console.log(devA.setPoint)
// devA.once('initialized', () => {
//   console.log(devA.setPoint)
// })

// setInterval(() => {
//   console.log(devA.massFlow)
// }, 300)

// for actual physical device testing

// var router = new ad.Router({portPath: '/dev/ttyUSB0', testFlag: false, baud: 19200})

// setTimeout(() => {
//   var router = new ad.Router({portPath: '/dev/ttyUSB3', testFlag: false, baud: 19200, manufacturer: 'FTDI', seriallineSerial: 'A904DU60'})
//   var devA = new DeviceMFC({id: 'D', router: router, testFlag: false, debugTest: true})
//   if (router.open) {
//     devA.initialize()
//   } else {
//     router.once('open', () => {
//       devA.initialize()
//     })
//   }
//   devA.once('initialized', () => {
//     console.log('Initialized')
//     //   var gasList = devA.gasList
//     //   var massFlow = devA.massFlow
//     //
//     //   // devA.gas = 'Air'
//     //   // console.log(devA.property.get('firmware'))
//     console.log('parser fields')
//     console.log(devA.parserFields)
//     console.log('rev')
//     console.log(devA.revision)
//     console.log('partNumber')
//     console.log(devA.partNumber)
//     // console.log('setpoint = 1')
//     // devA.setPoint = 0.25
//     //   // console.log(devA.revision)
//     setInterval(() => {
//       console.log(devA.setPoint)
//       console.log(devA.massFlow)
//       console.log(devA.gas)
//     }, 300)
//   })
// //
// }, 4000)

// to make the MFCs hot-pluggable
