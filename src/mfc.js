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

const alicatMFC = require('./alicat-mfc.js')
const ui = require('./ui.js')
// const fs = require('fs')
const bkup = require('./backup.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')

var mfcID = 'MFCs'
var mfcsPath = 'config/' + mfcID

var mfcMap = {
  A: {ID: 'A', Description: 'H2O2', Details: '', setPoint: 0, gasType: 'Air'},
}

class MFC {
  constructor({id,
    router,
    testFlag,
    Description,
    Details,
    thisMFCsPath = mfcsPath,
    thisMFCmap = mfcMap,
    // apiReinit,
  }) {
    this.ID = new ui.ShowUser({value: id.toString()})
    Object.defineProperty(this, 'hidden', {
      value: new alicatMFC.Device({id: id, router: router, testFlag: testFlag, debugTest: false}),
    })
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    // console.log(this.hidden)
    Object.defineProperty(this, 'Gas Type', {
      enumerable: true,
      get: function () {
        var gas = this.hidden.gas
        // var val = this.hidden.gas.value
        // if (this.testFlag) console.log(gas)
        // if (this.testFlag) console.log(val)

        return (new ui.ShowUser({value: gas.value, type: ['output', 'list']}))
      },
      set: function (val) {
        this.hidden.gas = val
      },
    })
    this.datastreams = {data: this.hidden.property, refreshRate: 1000}
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    this.updateable = ['Gas Type', 'Port']
    this.nonupdateable = ['Firmware']
    Object.defineProperty(this, 'Gas Typelist', {
      get: function () {
        return [...this.hidden.property.get('gasList').values()]
      },
    })
    Object.defineProperty(this, 'Mass Flow', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.massFlow, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Pressure', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.pressure, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Temperature', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.temperature, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Volumetric Flow', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.volumeFlow, type: ['input', 'datapoint']})
      },
    })
    Object.defineProperty(this, 'Set Point', {
      enumerable: true,
      get: function () {
        return new ui.ShowUser({value: this.hidden.setPoint, type: ['output', 'datapoint']})
      },
      set: function (val) {
        console.log('Insider setpoint setter')
        this.hidden.setPoint = val
      },
    })
    Object.defineProperty(this, 'Reinitialize', {
      enumerable: true,
      get: () => {
        return (new ui.ShowUser({value: new ui.Action({name: 'post', data: ''}), type: ['output', 'button']}))
      },
      set: ({res}) => {
        var dbState = this.Database.value[0].obj['0'].Enable.value
        this.Database.value[0].obj['0'].Enable = false
        var t = setTimeout(() => {
          var initListeners = this.hidden.listeners('initialized')
          if (initListeners[initListeners.length - 1] !== undefined) {
            this.hidden.removeListener('initialized', initListeners[initListeners.length - 1])
          }
        }, 10000)
        this.hidden.once('initialized', () => {
          clearTimeout(t)
          this.Database.value[0].obj['0'].Enable = dbState
        })

        this.hidden.reinitialize({id: this.ID.value})
        res.json({type: ['unknown']})
        // apiReinit()
      },
    })
    Object.defineProperty(this, 'Port', {
      enumerable: true,
      get: function () {
        // if (this.testFlag) console.log(this.hidden.router.portPath)
        // if (this.testFlag) console.log(val)

        return (new ui.ShowUser({value: this.hidden.router.portPath, type: ['output', 'list']}))
      },
      set: function (val) {
        console.log('New Port')
        console.log(val)

        // only reopen if it's different
        if (val !== this.hidden.router.portPath) {
          var dbState = []
          var t = []
          Object.entries(thisMFCmap).forEach(([key], i) => {
            dbState[i] = thisMFCmap[key].Database.value[0].obj['0'].Enable.value
            thisMFCmap[key].Database.value[0].obj['0'].Enable = false
            console.log('dbState')
            console.log(dbState[i])
            setTimeout(() => {
              console.log('dbState')
              console.log(dbState[i])
              t[i] = setTimeout(() => {
                var initListeners = thisMFCmap[key].hidden.listeners('initialized')
                if (initListeners[initListeners.length - 1] !== undefined) {
                  thisMFCmap[key].hidden.removeListener('initialized', initListeners[initListeners.length - 1])
                }
              }, 10000)
              thisMFCmap[key].hidden.once('initialized', () => {
                clearTimeout(t[i])
                thisMFCmap[key].Database.value[0].obj['0'].Enable = dbState[i]
              })

              thisMFCmap[key].hidden.initialize()
            }, 2000)
          })
          this.hidden.router.reopen({portPath: val})
        }
      },
    })
    Object.defineProperty(this, 'Portlist', {
      get: function () {
        return this.hidden.router.PortList
      },
    })
    if (this.hidden.property !== undefined) {
      Object.defineProperty(this, 'Firmware', {
        enumerable: true,
        get: function () {
          return new ui.ShowUser({value: this.hidden.property.get('firmware'), type: ['input', 'string']})
        },
      })
    }
    Object.defineProperty(this, 'portPath', {
      get: () => {
        return this.hidden.router.portPath
      },
    })
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'mfc_basic_port',
          fields: [
            'Gas Type',
            'Mass Flow',
            'Volumetric Flow',
            'Pressure',
            'Temperature',
            'Set Point',
          ],
          tags: ['portPath'],
          obj: this,
          testFlag: true,
          objPath: thisMFCsPath,
        })},
        path: thisMFCsPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }
}

module.exports = {
  initialize: async function (test, reinit) {
    console.log('intializing mfcs')
    test = false
    // var router = false
    var router = new ad.Router({
      portPath: 'COM3',
      testFlag: test,
      maxQueueLength: 100,
      baud: 19200,
      // manufacturer: 'FTDI',
      manufacturer: 'Prolific Technology Inc. ',
      seriallineSerial: 'AK04YSXA',
      delimiter: '\r'
    })
    if (!test) {
      try {
        await router.openPort()
      } catch (error) {
        console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
        throw error
      }
    }

    if (bkup.configExists(mfcsPath)) {
      // this should eventually be in a try-catch with a default config
      var loadMap = bkup.load(mfcsPath)
      Object.entries(loadMap).forEach(([key, value]) => {
        // specify bare-minimum amount that the config should have
        if (value.ID) {
          console.log(key)
          if (mfcMap[key]) {
            // just overwrite it
            console.log('overwriting it')
          } else {
            // add the key
            console.log('Adding it')
          }
          mfcMap[key] = new MFC({id: value.ID.value,
            router: router,
            testFlag: test,
            Description: value.Description.value,
            Details: value.Details.value,
            apiReinit: reinit,
            thisMFCsPath: mfcsPath,
            thisMFCmap: mfcMap,
          })
          mfcMap[key].hidden.once('initialized', () => {
            // this could technically be done a little bit sooner at the driver level, but
            // the time difference is neglible, and setting parameters is slightly outside the
            // scope of a driver
            // if (value['Gas Type'].value != undefined) {
            //   console.log('Setting gas type: '+value['Gas Type'].value)
            //   mfcMap[key].hidden.gas = value['Gas Type'].value
            // }
            // if (value['Set Point'].value.value != undefined) {
            //   console.log('Setting set point: '+value['Set Point'].value.value)
            //   mfcMap[key].hidden.setPoint = value['Set Point'].value.value
            // }

            // this one is useful for actual usage
            bkup.save(mfcMap[key], mfcsPath)
          })
        } else {
          // did not have bare minimum so fail out loudly
          console.log('Configuration missing critical component(s):')
          console.log('value.ID')
          console.log(value)
        }
      })
    } else {
      // re-write mfcMap object into object of MFC classes
      Object.entries(mfcMap).forEach(([key, value]) => {
        mfcMap[key] = new MFC({id: value.ID,
          router: router,
          testFlag: test,
          Description: value.Description,
          Details: value.Details,
          thisMFCsPath: mfcsPath,
          thisMFCmap: mfcMap,
        })
        mfcMap[key].hidden.once('initialized', () => {
          // this could technically be done a little bit sooner at the driver level, but
          // the time difference is neglible, and setting parameters is slightly outside the
          // scope of a driver
          // if (value.gasType) {
          //   console.log('Setting gas type: ' + value.gasType)
          //   mfcMap[key].hidden.gas = value.gasType
          // }
          // if (value.setPoint) {
          //   console.log('Setting set point: ' + value.setPoint)
          //   mfcMap[key].hidden.setPoint = value.setPoint
          // }

          // this one is useful for actual usage
          bkup.save(mfcMap[key], mfcsPath)
        })
        // this one is useful for debugging
        // bkup.save(mfcMap[key], mfcsPath)
        // console.log(mfcMap[key])
      })
    }
    // console.log('mfcMap')
    // console.log(mfcMap)
    for (var [key] of Object.entries(mfcMap)) {
      try {
        await mfcMap[key].hidden.initialize()
      } catch (error) {
        console.log('MFC init ERROR')
        console.log('MFC: ' + key)
        console.log(error)
      }
    }
    return
  },
  setOutput: function () {

  },
  id: mfcID,
  obj: mfcMap,
  path: mfcsPath,
  Device: MFC,
}
