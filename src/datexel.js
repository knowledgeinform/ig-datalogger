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

const ui = require('./ui.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')
const bkup = require('./backup.js')
const dat3016 = require('./dat3016.js')

var datexelID = 'Datexel'
var datexelPath = 'config/' + datexelID

class Datexel {
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

    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: new dat3016.Device({router, testFlag})
    })

    Object.defineProperty(this, 'PV0', {
      enumerable: true,
      get: () => {
        this.hidden.getPV(0, () => {
          console.log('Raw PV0')
          console.log(this.hidden.hidden.processValue[0].value)
          this.hidden.hidden.processValue[0].value /= 10
        }).catch(error => {
          console.log('Datexel error getting PV0')
          console.log(error)
        })
        return new ui.ShowUser({value: this.hidden.hidden.processValue[0], type: ['input', 'datapoint']})
      }
    })

    // note that in value, the path is intentionally left undefined for now
    console.log(testFlag)
    this.datastreams = {refreshRate: 300}
    this.updateable = ['Position']
    this.initialize()
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'Datexel_basic',
          fields: ['PV0'],
          obj: this,
          testFlag: this.testFlag,
          objPath: datexelPath,
        })},
        path: datexelPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }

  initialize() {
    this.hidden.setAinput('Tc K').catch(error => {
      console.log('Datexel initialize error setting analog input type')
      console.log(error)
    })
  }
}

var datexelmap = {}
var datexelList = ['0']
var ports = ['COM6']
var manufacturers = ['FTDI']
var serialLineSerials = ['FT67G9XT']

module.exports = {
  initialize: async function (test) {
    // test = false
    console.log('intializing Datexels')

    var i = 0
    var routers = []
    for (i = 0; i < datexelList.length; i++) {
      var datexel = datexelList[i]
      routers.push(new ad.Router({
          portPath: ports[i],
          baud: 38400,
          testFlag: false,
          timing: true,
          timeInterval: 200,
          manufacturer: manufacturers[i],
          // manufacturer: 'Prolific Technology Inc.',
          serialNumberSerial: serialLineSerials[i],
        }))
      if (!test) {
        try {
          await routers[i].openPort()
        } catch (error) {
          console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
          throw error
        }
      }
      datexelmap[datexel] = new Datexel({id: datexel, testFlag: test, router: routers[i], debugTest: false})
      datexelmap[datexel].initialize()
    }

    return
  },
  id: datexelID,
  obj: datexelmap,
  path: datexelPath,
}
