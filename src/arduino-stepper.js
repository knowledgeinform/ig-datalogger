/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ui = require('./ui.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')

var arduinoStepperID = 'Arduino Stepper'
var arduinoStepperPath = 'config/' + arduinoStepperID

class ArduinoStepper {
  constructor({id, Description = '', Details = '', router, testFlag = true, debugTest = false}) {
    // super()
    this.ID = new ui.ShowUser({value: id})
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    Object.defineProperty(this, 'debugTest', {
      writable: true,
      value: debugTest,
    })

    Object.defineProperty(this, 'serialControl', {
      writable: true,
      value: new ad.SerialControl({
        router: router,
        testFlag: this.testFlag,
        timeout: 200,
        debugTest: this.debugTest,
      }),
    })

    Object.defineProperty(this, 'hiddenLimits', {
      value: [0, 1600] // (specified in Arduino Sketch)
    })

    /// ////////////////////////////////////////////////////////////////////////////
    Object.defineProperty(this, 'hiddenPosition', {
      writable: true,
      value: new ad.DataPoint({value: 1600, units: 'steps'}), // default position (specified in Arduino Sketch)
    })
    Object.defineProperty(this, 'Position', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hiddenPosition, type: ['input', 'datapoint']}))
      },
    })
    /// ////////////////////////////////////////////////////////////////////////////
    Object.defineProperty(this, 'hiddenStatus', {
      writable: true,
      value: 'Ready',
    })
    Object.defineProperty(this, 'Status', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hiddenStatus, type: ['input', 'string']}))
      },
    })

    Object.defineProperty(this, 'hiddenStepChange', {
      writable: true,
      value: new ad.DataPoint({units: 'steps'}),
    })

    Object.defineProperty(this, 'Step Change', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: this.hiddenStepChange, type: ['output', 'datapoint']}))
      },
      set: val => {
        val = Number(val)
        val = Math.round(val)
        console.log('here')
        console.log(val)
        if (this.hiddenStatus === 'Ready' &&
          (val + this.hiddenPosition.value >= this.hiddenLimits[0]) &&
          (val + this.hiddenPosition.value <= this.hiddenLimits[1]) ) {
          this.hiddenStepChange.value = val
          this.hiddenStepChange.time = Date.now()
          this.sendSteps(val)
        }
      }
    })

    /// ////////////////////////////////////////////////////////////////////////////
    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 300}
    this.updateable = []
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'ArduinoStepper_basic',
          fields: ['Position', 'Step Change'],
          obj: this,
          testFlag: true,
          objPath: arduinoStepperPath,
        })},
        path: arduinoStepperPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }

  async sendSteps(val) {
    this.hiddenStatus = 'Writing'
    var timeout = Math.round(Math.abs(val) * 40 * 1.1) // roughly 40 ms per step
    var command = val.toString() + '\r'
    try {
      var resp = await this.serialControl.serial(command, false, timeout)
      resp = resp[0].toString()
      this.hiddenPosition.value = Number(resp)
      this.hiddenPosition.time = Date.now()
      this.hiddenStatus = 'Ready'
    } catch (error) {
      console.log('Arduino Stepper Error')
      console.log(error)
      console.log(resp)
      this.hiddenStatus = error
      setTimeout(this.clearError.bind(this), 5000) // clear the error after 5 secondss
    }
  }

  clearError() {
    this.hiddenStatus = 'Ready'
  }

  initialize() {
    // not currently used
  }
}

var ardmap = {}
var ardList = ['A']
var ports = ['/dev/ttyUSB2']
var serialLineSerials = ['758343531313515171E0']

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing ArduinoSteppers')
    var i = 0
    for (i = 0; i < ardList.length; i++) {
      var ard = ardList[i]
      var router = new ad.Router({portPath: ports[i], baud: 57600, testFlag: test, manufacturer: 'Arduino (www.arduino.cc)', seriallineSerial: serialLineSerials[i]})
      if (!test) {
        try {
          await router.openPort()
        } catch (error) {
          console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
          throw error
        }
      }
      ardmap[ard] = new ArduinoStepper({id: ard, testFlag: test, router: router, debugTest: false})
    }

    return
  },
  id: arduinoStepperID,
  obj: ardmap,
}

// async function f() {
//   var test = false
//   for (i = 0; i < ardList.length; i++) {
//     var ard = ardList[i]
//     var router = new ad.Router({portPath: ports[i], baud: 9600, testFlag: test, timing: true, manufacturer: 'Prolific', seriallineSerial: serialLineSerials[i]})
//     if (!test) {
//       try {
//         await router.openPort()
//       } catch (error) {
//         console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
//         throw error
//       }
//     }
//     ardmap[ard] = new ArduinoStepper({id: ard, testFlag: test, router: router, debugTest: true})
//   }

//   setInterval(() => {
//     console.log(ardmap['A'].Concentration)
//   }, 500)
// }

// console.log('Waiting 4 s for serial devices')
// setTimeout(f, 4000)
