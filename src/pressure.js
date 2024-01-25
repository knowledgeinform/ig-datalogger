const rpio = require('rpio')
const ui = require('./ui.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
const db = require('./database.js')
// var async = require('async')

var ADCID = 'ADCs'
var ADCsPath = 'config/' + ADCID

var ADCMap = {
  'Pressure 1': {
    address: 0x48,
    chP: 0,
    chN: 1,
    singleDifferential: true,
    pga: 2048,
    sps: 128,
    calSlope: 0,
    calOffset: 0,
    calSlopePV: 0,
    calOffsetPV: 0,
    Description: 'Scale is in mV. What does this pressure sensor measure?',
    pvUnits: 'psi',
  },
  'Pressure 2': {
    address: 0x48,
    chP: 2,
    chN: 3,
    singleDifferential: true,
    pga: 2048,
    sps: 128,
    calSlope: 0,
    calOffset: 0,
    calSlopePV: 0,
    calOffsetPV: 0,
    Description: 'Scale is in mV. What does this pressure sensor measure?',
    pvUnits: 'psi',
  },
}

var defaultAddress = [0x48, 0x49, 0x4B] // GND, VDD, SCL addresses for ADS1115

// chip

var IC_ADS1015 = 0x00
var IC_ADS1115 = 0x01

// Pointer Register
var ADS1015_REG_POINTER_MASK = 0x03
var ADS1015_REG_POINTER_CONVERT = 0x00
var ADS1015_REG_POINTER_CONFIG = 0x01
var ADS1015_REG_POINTER_LOWTHRESH = 0x02
var ADS1015_REG_POINTER_HITHRESH = 0x03

// Config Register
var ADS1015_REG_CONFIG_OS_MASK = 0x8000
var ADS1015_REG_CONFIG_OS_SINGLE = 0x8000 // Write: Set to start a single-conversion
var ADS1015_REG_CONFIG_OS_BUSY = 0x0000 // Read: Bit = 0 when conversion is in progress
var ADS1015_REG_CONFIG_OS_NOTBUSY = 0x8000 // Read: Bit = 1 when device is not performing a conversion
var ADS1015_REG_CONFIG_MUX_MASK = 0x7000
var ADS1015_REG_CONFIG_MUX_DIFF_0_1 = 0x0000 // Differential P = AIN0, N = AIN1 (default)
var ADS1015_REG_CONFIG_MUX_DIFF_0_3 = 0x1000 // Differential P = AIN0, N = AIN3
var ADS1015_REG_CONFIG_MUX_DIFF_1_3 = 0x2000 // Differential P = AIN1, N = AIN3
var ADS1015_REG_CONFIG_MUX_DIFF_2_3 = 0x3000 // Differential P = AIN2, N = AIN3
var ADS1015_REG_CONFIG_MUX_SINGLE_0 = 0x4000 // Single-ended AIN0
var ADS1015_REG_CONFIG_MUX_SINGLE_1 = 0x5000 // Single-ended AIN1
var ADS1015_REG_CONFIG_MUX_SINGLE_2 = 0x6000 // Single-ended AIN2
var ADS1015_REG_CONFIG_MUX_SINGLE_3 = 0x7000 // Single-ended AIN3
var ADS1015_REG_CONFIG_PGA_MASK = 0x0E00
var ADS1015_REG_CONFIG_PGA_6_144V = 0x0000 // +/-6.144V range
var ADS1015_REG_CONFIG_PGA_4_096V = 0x0200 // +/-4.096V range
var ADS1015_REG_CONFIG_PGA_2_048V = 0x0400 // +/-2.048V range (default)
var ADS1015_REG_CONFIG_PGA_1_024V = 0x0600 // +/-1.024V range
var ADS1015_REG_CONFIG_PGA_0_512V = 0x0800 // +/-0.512V range
var ADS1015_REG_CONFIG_PGA_0_256V = 0x0A00 // +/-0.256V range
var ADS1015_REG_CONFIG_MODE_MASK = 0x0100
var ADS1015_REG_CONFIG_MODE_CONTIN = 0x0000 // Continuous conversion mode
var ADS1015_REG_CONFIG_MODE_SINGLE = 0x0100 // Power-down single-shot mode (default)
var ADS1015_REG_CONFIG_DR_MASK = 0x00E0
var ADS1015_REG_CONFIG_DR_128SPS = 0x0000 // 128 samples per second
var ADS1015_REG_CONFIG_DR_250SPS = 0x0020 // 250 samples per second
var ADS1015_REG_CONFIG_DR_490SPS = 0x0040 // 490 samples per second
var ADS1015_REG_CONFIG_DR_920SPS = 0x0060 // 920 samples per second
var ADS1015_REG_CONFIG_DR_1600SPS = 0x0080 // 1600 samples per second (default)
var ADS1015_REG_CONFIG_DR_2400SPS = 0x00A0 // 2400 samples per second
var ADS1015_REG_CONFIG_DR_3300SPS = 0x00C0 // 3300 samples per second (also 0x00E0)
var ADS1115_REG_CONFIG_DR_8SPS = 0x0000 // 8 samples per second
var ADS1115_REG_CONFIG_DR_16SPS = 0x0020 // 16 samples per second
var ADS1115_REG_CONFIG_DR_32SPS = 0x0040 // 32 samples per second
var ADS1115_REG_CONFIG_DR_64SPS = 0x0060 // 64 samples per second
var ADS1115_REG_CONFIG_DR_128SPS = 0x0080 // 128 samples per second
var ADS1115_REG_CONFIG_DR_250SPS = 0x00A0 // 250 samples per second (default)
var ADS1115_REG_CONFIG_DR_475SPS = 0x00C0 // 475 samples per second
var ADS1115_REG_CONFIG_DR_860SPS = 0x00E0 // 860 samples per second
var ADS1015_REG_CONFIG_CMODE_MASK = 0x0010
var ADS1015_REG_CONFIG_CMODE_TRAD = 0x0000 // Traditional comparator with hysteresis (default)
var ADS1015_REG_CONFIG_CMODE_WINDOW = 0x0010 // Window comparator
var ADS1015_REG_CONFIG_CPOL_MASK = 0x0008
var ADS1015_REG_CONFIG_CPOL_ACTVLOW = 0x0000 // ALERT/RDY pin is low when active (default)
var ADS1015_REG_CONFIG_CPOL_ACTVHI = 0x0008 // ALERT/RDY pin is high when active
var ADS1015_REG_CONFIG_CLAT_MASK = 0x0004 // Determines if ALERT/RDY pin latches once asserted
var ADS1015_REG_CONFIG_CLAT_NONLAT = 0x0000 // Non-latching comparator (default)
var ADS1015_REG_CONFIG_CLAT_LATCH = 0x0004 // Latching comparator
var ADS1015_REG_CONFIG_CQUE_MASK = 0x0003
var ADS1015_REG_CONFIG_CQUE_1CONV = 0x0000 // Assert ALERT/RDY after one conversions
var ADS1015_REG_CONFIG_CQUE_2CONV = 0x0001 // Assert ALERT/RDY after two conversions
var ADS1015_REG_CONFIG_CQUE_4CONV = 0x0002 // Assert ALERT/RDY after four conversions
var ADS1015_REG_CONFIG_CQUE_NONE = 0x0003 // Disable the comparator and put ALERT/RDY in high state (default)

// This is a javascript port of python, so use objects instead of dictionaries here
// These simplify and clean the code (avoid the abuse of if/elif/else clauses)
var spsADS1115 = {
  8: ADS1115_REG_CONFIG_DR_8SPS,
  16: ADS1115_REG_CONFIG_DR_16SPS,
  32: ADS1115_REG_CONFIG_DR_32SPS,
  64: ADS1115_REG_CONFIG_DR_64SPS,
  128: ADS1115_REG_CONFIG_DR_128SPS,
  250: ADS1115_REG_CONFIG_DR_250SPS,
  475: ADS1115_REG_CONFIG_DR_475SPS,
  860: ADS1115_REG_CONFIG_DR_860SPS,
}

var spsADS1015 = {
  128: ADS1015_REG_CONFIG_DR_128SPS,
  250: ADS1015_REG_CONFIG_DR_250SPS,
  490: ADS1015_REG_CONFIG_DR_490SPS,
  920: ADS1015_REG_CONFIG_DR_920SPS,
  1600: ADS1015_REG_CONFIG_DR_1600SPS,
  2400: ADS1015_REG_CONFIG_DR_2400SPS,
  3300: ADS1015_REG_CONFIG_DR_3300SPS,
}

// Dictionary with the programable gains

var pgaADS1x15 = {
  6144: ADS1015_REG_CONFIG_PGA_6_144V,
  4096: ADS1015_REG_CONFIG_PGA_4_096V,
  2048: ADS1015_REG_CONFIG_PGA_2_048V,
  1024: ADS1015_REG_CONFIG_PGA_1_024V,
  512: ADS1015_REG_CONFIG_PGA_0_512V,
  256: ADS1015_REG_CONFIG_PGA_0_256V,
}

function readADCDifferential(multi,
  {chP = 0,
    chN = 1,
    pga = 6144,
    sps = 128,
    callback,
    ic,
    cal = {slope: 1.0, offset: 0},
    testFlag = false,
    address = 0x49,
    baud = 100000, // 100 kHz default
  }, timeout) {
  // console.log('Here 213')
  if (!testFlag) rpio.i2cSetSlaveAddress(address)
  // console.log('Here 215')
  if (!testFlag) rpio.i2cSetBaudRate(baud)
  // console.log('Here 217 testFlag ' + testFlag.toString())
  // Disable comparator, Non-latching, Alert/Rdy active low
  // traditional comparator, single-shot mode
  var config = ADS1015_REG_CONFIG_CQUE_NONE | ADS1015_REG_CONFIG_CLAT_NONLAT |
  ADS1015_REG_CONFIG_CPOL_ACTVLOW | ADS1015_REG_CONFIG_CMODE_TRAD |
  ADS1015_REG_CONFIG_MODE_SINGLE

  // Set channels
  if ((chP === 0) & (chN === 1)) {
    config |= ADS1015_REG_CONFIG_MUX_DIFF_0_1
  } else if ((chP === 0) & (chN === 3)) {
    config |= ADS1015_REG_CONFIG_MUX_DIFF_0_3
  } else if ((chP === 2) & (chN === 3)) {
    config |= ADS1015_REG_CONFIG_MUX_DIFF_2_3
  } else if ((chP === 1) & (chN === 3)) {
    config |= ADS1015_REG_CONFIG_MUX_DIFF_1_3
  } else {
    // self.busy = false
    console.log('ADS1x15: Invalid channels specified')
    callback('ADS1x15: Invalid channels specified')
  }

  // Set sample per seconds, defaults to 250sps
  // If sps is in the dictionary (defined in init()) it returns the value of the constant
  // othewise it returns the value for 250sps. This saves a lot of if/elif/else code!
  if (ic === IC_ADS1015) {
    config |= spsADS1015[sps]
  } else {
    if ((spsADS1115[sps] === undefined)) {
      // self.busy = false
      callback('ADS1x15: Invalid sps specified')
    } else {
      config |= spsADS1115[sps]
    }
  }
  // Set PGA/voltage range, defaults to +-6.144V
  // console.log('pga')
  // console.log(pga)
  // console.log(pgaADS1x15[pga])
  if (pgaADS1x15[pga] === undefined) {
    // self.busy = false
    callback('ADS1x15: Invalid pga specified')
  } else {
    config |= pgaADS1x15[pga]
  }
  // Set 'start single-conversion' bit
  config |= ADS1015_REG_CONFIG_OS_SINGLE
  // Write config register to the ADC
  var bytes = [(config >> 8) & 0xFF, config & 0xFF]
  // console.log(bytes)
  var send = Buffer.from([ADS1015_REG_POINTER_CONFIG, bytes[0], bytes[1]])
  // console.log('Send')
  // console.log(send)
  if (!testFlag) rpio.i2cWrite(send)
  var delay = Math.round(1000 / sps) + 3 // changing the 1 to 3 because 1 is too fast

  var send2 = Buffer.from([ADS1015_REG_POINTER_CONVERT])
  // console.log('Send')
  // console.log(send2)
  if (!testFlag) rpio.i2cWrite(send2)
  // var delay = 1

  if (testFlag) {
    return new Promise(resolve => {
      resolve({rawData: 0, calData: 0})
    })
  }

  return new Promise(resolve => {
    setTimeout(() => {
      var rxbuf = Buffer.alloc(2)
      // var rxbuf2 = Buffer.alloc(2)
      if (!testFlag) rpio.i2cRead(rxbuf)
      // if (!testFlag) rpio.i2cWrite(send)
      // if (!testFlag) rpio.i2cRead(rxbuf2)

      var data = -1
      var val = (rxbuf[0] << 8) | (rxbuf[1])
      if (val > 0x7FFF) {
        data =  (val - 0xFFFF) * pga / 32768.0
      } else {
        data =  ((rxbuf[0] << 8) | (rxbuf[1])) * pga / 32768.0
      }
      // console.log(testFlag)
      var calData = (data * (1 + cal.slope)) + cal.offset
      // console.log(data / 1000)
      console.log('address: ' + address.toString(16))
      console.log('ChP: ' + chP)
      console.log('ChN: ' + chN)
      console.log(data)
      return resolve({rawData: data, calData: calData})
    }, delay)
  })
}

function test(obj, data) {
  console.log('Test called')
  console.log(obj)
  console.log(data)
}

class PromiseQueue {
  constructor({maxQueueLength = 100,
    queueName = 'ADC queue',
    interMessageWait = 0,
    debugTest = false,
    func, // function that must be executed synchronously
  }) {
    this.maxQueueLength = maxQueueLength
    this.queue = []
    this.queueName = queueName
    this.interMessageWait = interMessageWait
    this.debugTest = debugTest
    this.func = func
  }

  interMessageDelay() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, this.interMessageWait)
    })
  }

  send(command, multi, timeout) {
    if (this.queue.length > this.maxQueueLength) {
      console.log('Too many router commands queued for ' + this.queueName)
      console.log('Queue size: ' + this.maxQueueLength)
      throw new Error('Too many router commands queued')
    } else {
      if (this.debugTest) {
        console.log('queue length')
        console.log(this.queue.length)
        console.log('Command')
        console.log(command)
      }
    }
    // console.log('queue length: ' + this.queue.length.toString())
    var lastPromise = this.queue[this.queue.length - 1]
    var cmdPromise = async lastPromise => {
      if (lastPromise) {
        try {
          await lastPromise
          if (this.interMessageWait > 0) {
            await this.interMessageDelay()
          }
        } catch (error) {
          // last promise error'd out --> the next command probably doesn't care
        }
        var indexOfLP = this.queue.indexOf(lastPromise)
        if (indexOfLP >= 0) {
          // console.log('removing last promise')
          // remove the last Promise from the queue
          this.queue.splice(indexOfLP, 1)
        } else {
          throw new Error('Big problem in router queue where last promise could not be found')
        }
      } else {
        // console.log('last promise not defined')
      }

      var resp
      resp = await this.func(multi, command, timeout)
      if (this.debugTest) console.log('serial resp')
      if (this.debugTest) console.log(resp)
      return resp
    }
    // console.log('pushing promise onto queue')
    this.queue.push(cmdPromise(lastPromise))

    return this.queue[this.queue.length - 1]
  }
}

// rpio.i2cBegin()
// rpio.i2cSetSlaveAddress(0x49)
// rpio.i2cSetBaudRate(100000)
// readADCDifferential({chP: 2, chN: 3, pga: 256, sps: 128, callback: test, ic: IC_ADS1115, cal: {slope: 0.275070896, offset: 0.006736747}})

class ADCsensor {
  constructor({
    ID = 'P1',
    address = '49',
    chP = 0,
    chN = 1,
    singleDifferential = false,
    pga = 2048,
    sps = 8,
    calSlope = 0.275070896,
    calOffset = 0.006736747,
    calSlopePV = 0,
    calOffsetPV = 0,
    Description = 'Scale is in mV',
    pvUnits = 'psi',
    testFlag = true,
    queue,
  }) {
    this.ID = new ui.ShowUser({value: ID})
    this.Address = new ui.ShowUser({value: address, type: ['input', 'string']})
    this.Differential = new ui.ShowUser({value: singleDifferential, type: ['output', 'binary']})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    Object.defineProperty(this, 'chP', {
      writable: true,
      value: chP,
    })
    Object.defineProperty(this, 'Positive Channel', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.chP, type: ['output', 'list']})
      },
      set: val => {
        // parse
        this.chP = val
      },
    })
    Object.defineProperty(this, 'Positive Channellist', {
      get: function () {
        return [0, 1, 2, 3]
      },
    })
    Object.defineProperty(this, 'chN', {
      writable: true,
      value: chN,
    })
    Object.defineProperty(this, 'Negative Channel', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.chN, type: ['output', 'list']})
      },
      set: val => {
        // parse
        this.chN = val
      },
    })
    Object.defineProperty(this, 'Negative Channellist', {
      get: function () {
        return [0, 1, 2, 3]
      },
    })
    Object.defineProperty(this, 'pga', {
      writable: true,
      value: pga,
    })
    Object.defineProperty(this, 'Scale', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.pga, type: ['output', 'list']})
      },
      set: val => {
        // parse
        this.pga = val
      },
    })
    Object.defineProperty(this, 'Scalelist', {
      get: function () {
        return [256, 512, 1024, 2048, 4096, 6144]
      },
    })
    Object.defineProperty(this, 'sps', {
      writable: true,
      value: sps,
    })
    Object.defineProperty(this, 'Samples per Second', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.sps, type: ['output', 'list']})
      },
      set: val => {
        // parse
        this.sps = val
      },
    })
    Object.defineProperty(this, 'Samples per Secondlist', {
      get: function () {
        return [128, 250, 490, 920, 1600, 2400, 3300]
      },
    })
    this.Description = new ui.ShowUser({value: Description})
    this['Volt Scale Slope'] = new ui.ShowUser({value: calSlope, type: ['output', 'number']})
    this['Volt Scale Offset'] = new ui.ShowUser({value: calOffset, type: ['output', 'number']})
    this['PV Scale Slope'] = new ui.ShowUser({value: calSlopePV, type: ['output', 'number']})
    this['PV Scale Offset'] = new ui.ShowUser({value: calOffsetPV, type: ['output', 'number']})
    this['PV Units'] = new ui.ShowUser({value: pvUnits})
    Object.defineProperty(this, 'output', {
      writable: true,
      value: 0,
    })
    Object.defineProperty(this, 'rawOutput', {
      writable: true,
      value: 0,
    })
    Object.defineProperty(this, 'calOutput', {
      writable: true,
      value: 0,
    })
    Object.defineProperty(this, 'PV', {
      enumerable: true,
      get: () => {
        this.getPV().catch(error => {
          console.log('Error getting ADC PV')
          console.log('ID: ' + this.ID.value)
          console.log('ADC: ' + this.Address.value)
          console.log('ChP: ' + this.chP)
          console.log('ChN: ' + this.chN)
          console.log(error)
        })
        return new ui.ShowUser({value: new ad.DataPoint({value: this.output, units: this['PV Units'].value}), type: ['input', 'datapoint']})
      },
    })
    this.datastreams = {refreshRate: 200}
    this.updateable = ['Positive Channel', 'Negative Channel', 'Scale', 'Samples per Second']
    this.nonupdateable = ['Address']
    Object.defineProperty(this, 'adcDiff', {
      value: queue,
    })

    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'adc_basic',
          fields: [
            'PV',
          ],
          tags: [],
          obj: this,
          testFlag: this.testFlag,
          objPath: ADCsPath,
        })},
        path: ADCsPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }

  async getPV() {
    // something
    // console.log(Buffer.from(this.Address.value, 'hex')[0])
    var ret = await this.adcDiff.send({chP: this['Positive Channel'].value,
      chN: this['Negative Channel'].value,
      pga: this.Scale.value,
      sps: this['Samples per Second'].value,
      callback: console.log,
      ic: IC_ADS1115,
      cal: {slope: this['Volt Scale Slope'].value, offset: this['Volt Scale Offset'].value},
      testFlag: this.testFlag,
      address: parseInt(this.Address.value, 16),
      baud: 100000,
    }, false, this.datastreams.refreshRate)
    // console.log(ret)
    this.rawOutput = ret.rawData
    this.calOutput = ret.calData
    this.output = (this.calOutput * (1 + this['PV Scale Slope'].value)) + this['PV Scale Offset'].value
  }
}

function checkPQ(pq, addr) {
  var addrName = Buffer.from(addr, 'hex')[0] + 'queue'
  for (var q of pq) {
    if (Object.prototype.hasOwnProperty.call(q, 'queueName')) {
      if (q.queueName === addrName) {
        // no need to add queue
        return q
      }
    } else {
      console.log(q)
      console.log(pq)
      throw new Error('Invalid Queue!')
    }
  }
  var newq = new PromiseQueue({queueName: addrName, func: readADCDifferential})
  pq.push(newq)
  return newq
}

module.exports = {
  initialize: async function (test, reinit) {
    console.log('intializing digitizers')
    // test = false
    // var router = false
    if (!test) rpio.i2cBegin()
    var i2cQueue = new PromiseQueue({
      queueName: 'i2c queue',
      func: readADCDifferential,
      maxQueueLength: 100,
      interMessageWait: 2,
      debugTest: false,
    })
    if (bkup.configExists(ADCsPath)) {
      // this should eventually be in a try-catch with a default config
      var loadMap = bkup.load(ADCsPath)
      Object.entries(loadMap).forEach(([key, value]) => {
        // specify bare-minimum amount that the config should have
        if (value.Address === undefined) {
          // did not have bare minimum so fail out loudly
          console.log('Configuration missing critical component(s):')
          console.log('value.Address')
          console.log(value)
        } else {
          ADCMap[key] = new ADCsensor({
            ID: key,
            address: value.Address.value,
            chP: value['Positive Channel'].value,
            chN: value['Negative Channel'].value,
            singleDifferential: value.Differential.value,
            pga: value.Scale.value,
            sps: value['Samples per Second'].value,
            calSlope: value['Volt Scale Slope'].value,
            calOffset: value['Volt Scale Offset'].value,
            calSlopePV: value['PV Scale Slope'].value,
            calOffsetPV: value['PV Scale Offset'].value,
            Description: value.Description.value,
            pvUnits: value['PV Units'].value,
            testFlag: test,
            queue: i2cQueue,
          })
        }
      })
    } else {
      // re-write ADCMap object into object of ADC classes
      Object.entries(ADCMap).forEach(([key, value]) => {
        ADCMap[key] = new ADCsensor({
          ID: key,
          address: value.address.toString(16),
          chP: value.chP,
          chN: value.chN,
          singleDifferential: value.singleDifferential,
          pga: value.pga,
          sps: value.sps,
          calSlope: value.calSlope,
          calOffset: value.calOffset,
          calSlopePV: value.calSlopePV,
          calOffsetPV: value.calOffsetPV,
          Description: value.Description,
          pvUnits: value.pvUnits,
          testFlag: test,
          queue: i2cQueue,
        })
        bkup.save(ADCMap[key], ADCsPath)
      })
    }
    return
  },
  id: ADCID,
  obj: ADCMap,
  path: ADCsPath,
  Device: ADCsensor,
}
