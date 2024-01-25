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
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// SPI pins
/*
 *  Pin | Function
 * -----|----------
 *   19 |   MOSI
 *   21 |   MISO
 *   23 |   SCLK
 *   24 |   CE0
 *   26 |   CE1
 */

const rpio = require('rpio')
const ui = require('./ui.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
const db = require('./database.js')

var thermometersID = 'thermometers'
var thermometersPath = 'config/' + thermometersID

var max6675MinReadInterval = 220 // ms

class ThermometerC {
  constructor({
    CSPin,
    thermometerNumber,
    Description,
    Details,
    testFlag = false,
  }) {
    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: {},
    })
    this.Thermometer = new ui.ShowUser({value: thermometerNumber.toString()})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    this.CSPin = new ui.ShowUser({value: CSPin, type: ['output', 'number']})
    this.hidden.Temperature = new ad.DataPoint({value: -9999, units: 'C'})

    Object.defineProperty(this, 'Temperature', {
      enumerable: true,
      get: () => {
        this.readCelsius()
        return new ui.ShowUser({value: this.hidden.Temperature, type: ['input', 'datapoint']})
      },
      set: val => {
        // empty method in case someone tries to post to temperature
        console.log('cannot set property to')
        console.log(val)
      },
    })

    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    this.datastreams = {refreshRate: 600}
    this.updateable = []

    Object.defineProperty(this, 'lastReadTime', {
      writable: true,
      value: Date.now(),
    })

    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'temperature_basic',
          fields: [
            'Temperature',
          ],
          tags: ['Thermometer'],
          obj: this,
          testFlag: this.testFlag,
          objPath: thermometersPath,
        })},
        path: thermometersPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }

  readCelsius() {
    var curTime = Date.now()
    if (curTime - this.lastReadTime >= max6675MinReadInterval) {
      this.lastReadTime = curTime
      var txbuf = Buffer.from([0x00, 0x00])
      var rxbuf = Buffer.from(txbuf)
      rpio.write(this.CSPin.value, rpio.LOW)
      rpio.spiTransfer(txbuf, rxbuf, txbuf.length)
      rpio.write(this.CSPin.value, rpio.HIGH)
      this.hidden.Temperature.time = this.lastReadTime
      // console.log('Thermometer ' + this.Thermometer.value)
      // console.log('CS pin ' + this.CSPin.value)
      // console.log(rxbuf)
      this.hidden.Temperature.value = (rxbuf.readInt16BE() >> 3) * 0.25
    }
  }

  initialize() {
    // nothing for now
    rpio.open(this.CSPin.value, rpio.OUTPUT, rpio.HIGH)
  }
}

// we should be using the physical header numbers for the IOs because the GPIOs
// change with revision. Because we don't actually use the gpio mapping in
// rpio, we don't actually use the GPIO numbers, since these *internally* map
// directly to header numbers which are used. Thus, with newer revisions,
// this internal mapping will stay constant, and thus, the header numbers will too

var thermometerMap = {
  1: {CSPin: 24, thermometerNumber: 1, Description: '', Details: ''},
  2: {CSPin: 26, thermometerNumber: 2, Description: '', Details: ''},
}

module.exports = {
  initialize: async function (test) {
    console.log('intializing thermometers')
    // intialize pins
    // test = false
    this.pinInit(test)

    if (bkup.configExists(thermometersPath)) {
      // this should eventually be in a try-catch with a default config
      var loadMap = bkup.load(thermometersPath)
      Object.entries(loadMap).forEach(([key, value]) => {
        // specify bare-minimum amount that the config should have
        if (value.CSPin.value === undefined) {
          // did not have bare minimum so fail out loudly
          console.log('Configuration missing critical component(s):')
          console.log('value.CSPin.value')
          console.log(value)
        } else {
          console.log(key)
          // console.log(value)
          thermometerMap[key] = new ThermometerC({
            CSPin: value.CSPin.value,
            thermometerNumber: value.Thermometer.value,
            Description: value.Description.value,
            Details: value.Details.value,
            testFlag: test,
          })
          // thermometerMap[key] = new MFC({id: value.ID.value,router: router, testFlag: test,Description: value.Description.value,Details: value.Details.value})
        }
        thermometerMap[key].initialize()
      })
    } else {
      // add details to valve map
      Object.entries(thermometerMap).forEach(([key, value]) => {
        var details = 'pin ' + value.CSPin
        thermometerMap[key] = new ThermometerC({
          CSPin: value.CSPin,
          Details: details,
          Description: value.Description,
          thermometerNumber: value.thermometerNumber,
          testFlag: test,
        })
        // console.log(value)
        thermometerMap[key].initialize()
        bkup.save(thermometerMap[key], thermometersPath)
      })
    }
    return
  },
  pinInit: function (test) {
    if (test) {
      console.log('Operating in test-mode')
      /*
       * Explicitly request mock mode to avoid warnings when running on known
       * unsupported hardware, or to test scripts in a different hardware
       * environment (e.g. to check pin settings).
       */
      rpio.init({mock: 'raspi-3', gpiomem: false})

      /* Override default warn handler to avoid mock warnings */
      rpio.on('warn', function () {})
    } else {
      console.log('NOT operating in test-mode')
    }
    rpio.spiBegin()
    rpio.spiSetClockDivider(64) // MAX6675, 64 == 3.9 MHz
    rpio.spiSetDataMode(0)       // MAX6675, CPOL = 0, CPHA = 0
  },
  id: thermometersID,
  obj: thermometerMap,
  path: thermometersPath,
}
