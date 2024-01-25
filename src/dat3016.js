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

const ad = require('./abstract-driver.js')
const crc16 = require('./lib/utils/crc16.js')
const dat3016LUT = require('./dat3016-lut.js')
var ModbusRTU = require('./lib/modbus-rtu.js')

// class CSWatlowSettings {
//   constructor({obj = revE.obj}) {
//     this.services = []
//   }
// }

/**
  Either generate buttons or generate pages
*/

class ControlDAT3016 {
  constructor({router, testFlag = true, rtuAddress = 1}) {
    this.rtuAddress = rtuAddress
    this.mb = new ModbusRTU()
    this.mb.setID(this.rtuAddress)
    this.index = 0
    this.val = 0
    this.router = router
    this.testFlag = testFlag
    this.serialControl = new ad.SerialControl({
      router: router,
      testFlag: testFlag,
      timeout: (this.router.timeInterval * 2),
      debugTest: false,
      interMessageWait: 1000,
    })

    this.hidden = {
      processValue: [new ad.DataPoint({value: 0.0, units: 'C'}), new ad.DataPoint({value: 0.0, units: 'C'}), new ad.DataPoint({value: 0.0}), new ad.DataPoint({value: 0.0})],
      setPoint: [new ad.DataPoint({value: 0.0}), new ad.DataPoint({value: 0.0}), new ad.DataPoint({value: 0.0}), new ad.DataPoint({value: 0.0})],
      inputType: 'NOT SET',
    }

    this.obj = dat3016LUT.obj
    this.numberPVs = 2
    this.numberSPs = 0
    this.Tmax = 1825 // from datexel datasheet for type B tc
  }

  commandString({loc, index, obj, val}) {
    var error = false
    var register
    var length
    var convert
    var rw = false // false for reading, true for writing
    var array
    // first check valid object path/reference
    loc.forEach((item, i) => {
      var i2
      var subobj = obj
      for (i2 = 0; i2 < i; i2++) {
        // console.log(loc[i2])

        subobj = subobj[loc[i2]]
      }
      // console.log(item)
      // console.log(subobj)

      if (!Object.prototype.hasOwnProperty.call(subobj, item)) {
        error = true
        console.log('INVALID OBJECT REFERENCE')
        console.log('Object:')
        console.log(subobj)
        console.log('Reference:')
        console.log(item)
      }
      if (i + 1 === loc.length && !error) {
        if (!Object.prototype.hasOwnProperty.call(subobj[item], 'Modbus')) {
          error = true
          console.log('FINAL REFERENCE DOES NOT HAVE MODBUS PROPERTY')
        }
        if (index >= subobj[item].Modbus.length) {
          error = true
          console.log('INVALID INDEX FOR Modbus')
          console.log('Modbus array length')
          console.log(subobj[item].Modbus.length)
          console.log('Requested index')
          console.log(index)
        } else {
          // console.log(subobj[item])
          // console.log(subobj[item].Modbus)
          // console.log(index)
          // console.log(subobj[item].Modbus[index])
          register = subobj[item].Modbus[index] - 1 // - 1 for datexel
          if ((subobj[item].Type[1] === 'W') && val !== undefined) {
            rw = true
          } else {
            rw = false
          }
          if (subobj[item].Type[0] === 'uint') {
            length = 1
            convert = this.convertUint
            if (rw) {
              array = Buffer.allocUnsafe(2)
              array.writeUInt16BE(val)
            }
          }
        }
      }
    })

    if (error) {
      return ''
    }
    if (this.testFlag) console.log('register: ' + register)
    if (this.testFlag) console.log('length: ' + length)

    var ret
    if (rw) {
      // console.log('Writing')
      ret = this.mb.writeFC16(this.mb._unitID, register, array)
    } else {
      // console.log('Reading')
      ret = this.mb.readHoldingRegisters(this.mb._unitID, register, length)
    }
    if (this.testFlag) console.log(ret)
    return {buf: ret, convert: convert}
  }

  convertUint(b) {
    // console.log('converting')
    // console.log(b)
    var ret = b.readUInt16BE(3)
    // console.log('ret')
    // console.log(ret)
    return ret
  }

  convertFloat(b) {
    // console.log('Converting')
    // console.log(b)
    var tmp = b.slice(3, -2)
    tmp = tmp.swap16()
    return tmp.readFloatLE(0)
  }

  basicCommandString({address, length = 1, value}) {
    if (address === undefined) {
      console.log('UNDEFINED ADDRESS FOR BASIC COMMAND')
      return ''
    }

    var ret
    if (value === undefined) {
      // read
      this.mb.readHoldingRegisters(this.mb._unitID, address, length)
    } else {
      // write
      this.mb.writeHoldingRegisters(this.mb._unitID, address, length, value)
    }

    if (this.testFlag) console.log(ret)
    return ret
  }

  async readFloatProperty(hiddenKey, mbAddr, obj) {
    // console.log(i)
    var command = this.basicCommandString({address: mbAddr, length: 2})
    // command = 'getPV'
    var time
    var resp
    resp = await this.serialControl.serial(command)
    time = Date.now()
    // console.log(this.resp)
    if (resp !== undefined) {
      obj.hidden[hiddenKey].value = this.convertFloat(resp[0])
      obj.hidden[hiddenKey].time = time
    }
  }

  async writeFloatProperty(hiddenKey, mbAddr, obj, val) {
    var command = this.basicCommandString({address: mbAddr, length: 2, value: val})
    await this.serialControl.serial(command)
  }

  async writeUintProperty(hiddenKey, mbAddr, obj, range, val) {
    // console.log(i)
    var command = this.basicCommandString({address: mbAddr, length: 1, value: val})
    await this.serialControl.serial(command)
  }

  get PV0() {
    var div = 10 ** (this.obj['Input Value'].decimals.Tc)
    this.setAinput('Tc K')
    this.getPV(0, () => {
      console.log('Raw PV0')
      console.log(this.hidden.processValue[0].value)
      this.hidden.processValue[0].value /= div
    })
    return this.hidden.processValue[0]
  }

  get PV1() {
    var div = 10 ** (this.obj['Input Value'].decimals['1000 mV'])
    this.setAinput('1000 mV')
    this.getPV(1, () => {
      this.hidden.processValue[1].value /= div
      this.hidden.processValue[1].value = (21.13 - 0.0) / (1000.0 - 200) * (this.hidden.processValue[1].value - 200) // mV --> inches
    })
    return this.hidden.processValue[1]
  }

  async getAinput() {
    // console.log(i)
    var command = this.commandString({loc: ['Input Type'], index: 0, obj: this.obj})
    // command = 'getPV'
    // console.log('Getting analog input type')
    // console.log(command)
    // var time
    var ret = 'UNDEFINED'
    var resp
    try {
      resp = await this.serialControl.serial(command.buf)
      // time = Date.now()
      // console.log(resp)
      if (resp !== undefined) {
        if (this.crcCheck(resp[0])) {
          ret = command.convert(resp[0])
          ret = Object.entries(this.obj['Input Type'].definitions).find(([, value]) => value === ret)
          this.hidden.inputType = ret[0]
          // this.hidden.inputType[i].time = time
        }
      }
    } catch (error) {
      console.log(error)
      return
    }
  }

  async setAinput(definedType) {
    // console.log('Setting SP'+i+' to '+val)
    if (!Object.prototype.hasOwnProperty.call(this.obj['Input Type'].definitions, definedType)) {
      console.log('Unknown intput type')
      console.log(definedType)
      console.log('Available types')
      console.log(this.obj['Input Type'].definitions)
      return
    }
    var val = this.obj['Input Type'].definitions[definedType]
    var command = this.commandString({loc: ['Input Type'], index: 0, obj: this.obj, val: val})
    // console.log(command.buf)
    // var time
    var resp
    try {
      resp = await this.serialControl.serial(command.buf)
      // time = Date.now()
    } catch (error) {
      console.log(error)
      return
    }
    // console.log(this.resp)
    if (resp !== undefined) {
      // if (this.crcCheck(resp[0])) {
      //
      // }
    }
  }

  get Ainput() {
    this.getAinput()
    return this.hidden.inputType
  }

  set Ainput(val) {
    this.setAinput(val)
  }

  async getPV(i, cb) {
    // console.log(i)
    var command = this.commandString({loc: ['Input Value'], index: i, obj: this.obj})
    // command = 'getPV'
    var time
    var resp
    try {
      resp = await this.serialControl.serial(command.buf)
      time = Date.now()
    } catch (error) {
      console.log(error)
      return
    }
    // console.log('resp')
    // console.log(resp)
    if (resp !== undefined) {
      if (this.crcCheck(resp[0])) {
        var checkVal = command.convert(resp[0])
        // if (checkVal !== 65524) {
        this.hidden.processValue[i].value = checkVal
        this.hidden.processValue[i].time = time
        // }
      }
    }
    if (cb === undefined) {
      return
    } else {
      return cb()
    }
  }

  crcCheck(b) {
    // console.log('crc check')
    // console.log(b)
    var crc = crc16(b.slice(0, -2))
    // console.log(crc.toString(16))
    if (crc === b.readUInt16LE(b.length - 2)) {
      // console.log('Good CRC')
      return true
    } else {
      // console.log('Bad CRC')
      return false
    }
  }

  initialize() {
  // initialize({router, testFlag}) {
    // if (router !== undefined) {
    //   this.router = router
    // }
    // if (this.router !== undefined) {
    //   console.log('controller init')
    //   console.log(testFlag)
    //   this.serialControl = new ad.SerialControl({
    //     router: this.router,
    //     testFlag: testFlag,
    //     debugTest: false,
    //     timeout: (this.router.timeInterval * 2),
    //   })
    // }
    //
    // if (testFlag !== undefined)
    //   this.testFlag = testFlag
  }
}

module.exports = {
  Device: ControlDAT3016,
}

// async function f() {
  // var r = new ad.Router({
  //   portPath: '/dev/tty.usbserial-FT1RX20H',
  //   baud: 38400,
  //   testFlag: false,
  //   timing: true,
  //   timeInterval: 200,
  //   // manufacturer: 'FTDI',
  //   // manufacturer: 'Prolific Technology Inc.',
  //   // serialNumberSerial: 'FT1RX20H',
  // })
//   try {
//     await r.openPort()
//   } catch (error) {
//     console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
//     throw error
//   }
//   var dat = new ControlDAT3016({router: r, testFlag: false})
//   // dat.Ainput = '1000 mV'
//   setInterval(() => {
//     console.log(dat.PV0)
//     console.log(dat.PV1)
//   }, 4000)
// }
//
// console.log('Waiting 4 seconds for serial ports')
// setTimeout(() => {
//   f()
// }, 4000)
