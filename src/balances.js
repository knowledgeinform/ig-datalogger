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

const ui = require('./ui.js')
const bkup = require('./backup.js')
const ad = require('./abstract-driver.js')
const db = require('./database.js')
var mettlerML204 = require('./mettler-ml204.js')
var sartoriusTE124S = require('./sartorius-te124s.js')

var balancesID = 'balances'
var balancesPath = 'config/' + balancesID

var balanceReadInterval = 320 // ms

class BalanceC {
  constructor({
    type,
    balanceNumber,
    Description,
    Details,
    testFlag = false,
    serialPort,
  }) {
    Object.defineProperty(this, 'hidden', {
      writable: true,
      value: {},
    })
    this.Balance = new ui.ShowUser({value: balanceNumber.toString()})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})
    this.Type = new ui.ShowUser({value: type})
    this.hidden.Mass = new ad.DataPoint({value: -9999, units: 'g'})
    this.hidden.instrument = this.selectInstrument()
    this.hidden.serialPort = serialPort

    Object.defineProperty(this, 'Mass', {
      enumerable: true,
      get: () => {
        this.readBalance()
        return new ui.ShowUser({value: this.hidden.Mass, type: ['input', 'datapoint']})
      },
      set: val => {
        // empty method in case someone tries to post to temperature
        console.log('cannot set property to')
        console.log(val)
      },
    })

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
          measurementName: 'balance_basic',
          fields: [
            'Mass',
          ],
          tags: ['Balance', 'Type'],
          obj: this,
          testFlag: this.testFlag,
          objPath: balancesPath,
        })},
        path: balancesPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }

  selectInstrument() {
    if (this.Type.value === 'ML204') {
      if (this.Description.value === '') this.Description.value = 'Mettler Toledo ML 204 Mass Balance'
      return mettlerML204
    } else if (this.Type.value === 'TE124S') {
      if (this.Description.value === '') this.Description.value = 'Sartorius TE124S Mass Balance'
      return sartoriusTE124S
    } else {
      this.Description.value = 'UNKNOWN MASS BALANCE TYPE'
      return {read: () => {
        console.log('UNKNOWN MASS BALANCE TYPE')
        return -800
      }}
    }
  }

  readBalance() {
    var curTime = Date.now()
    if (curTime - this.lastReadTime >= balanceReadInterval) {
      this.lastReadTime = curTime
      // something
      this.hidden.instrument.read(this.hidden.serialPort).then(ret => {
        this.hidden.Mass.value = ret
        this.hidden.Mass.time = Date.now()
      }).catch(error => {
        console.log('Balance error')
        console.log(error)
      })
    }
  }

  initialize() {
    // nothing for now
  }
}

// we should be using the physical header numbers for the IOs because the GPIOs
// change with revision. Because we don't actually use the gpio mapping in
// rpio, we don't actually use the GPIO numbers, since these *internally* map
// directly to header numbers which are used. Thus, with newer revisions,
// this internal mapping will stay constant, and thus, the header numbers will too

var balanceMap = {
  1: {type: 'ML204', balanceNumber: 1, Description: '', Details: ''},
}

module.exports = {
  initialize: async function (test) {
    console.log('intializing balances')
    // intialize pins
    var router = new ad.Router({
      portPath: '/dev/ttyUSB3',
      testFlag: test,
      maxQueueLength: 100,
      baud: 9600,
      // manufacturer: 'FTDI',
      manufacturer: 'FTDI',
      seriallineSerial: 'A603J5JA',
    })
    if (!test) {
      try {
        await router.openPort()
      } catch (error) {
        console.log('BIG OPEN PORT ERROR--Should NEVER reach here')
        throw error
      }
    }
    var serialPort = new ad.SerialControl({
      router: router,
      testFlag: test,
      timeout: balanceReadInterval,
    })

    if (bkup.configExists(balancesPath)) {
      // this should eventually be in a try-catch with a default config
      var loadMap = bkup.load(balancesPath)
      Object.entries(loadMap).forEach(([key, value]) => {
        // specify bare-minimum amount that the config should have
        if (value.Type.value === undefined) {
          // did not have bare minimum so fail out loudly
          console.log('Configuration missing critical component(s):')
          console.log('value.Type.value')
          console.log(value)
        } else {
          console.log(key)
          // console.log(value)
          balanceMap[key] = new BalanceC({
            type: value.Type.value,
            balanceNumber: value.Balance.value,
            Description: value.Description.value,
            Details: value.Details.value,
            testFlag: test,
            serialPort: serialPort,
          })
          // balanceMap[key] = new MFC({id: value.ID.value,router: router, testFlag: test,Description: value.Description.value,Details: value.Details.value})
        }
        balanceMap[key].initialize()
      })
    } else {
      // add details to valve map
      Object.entries(balanceMap).forEach(([key, value]) => {
        balanceMap[key] = new BalanceC({
          type: value.type,
          Details: value.Details,
          Description: value.Description,
          balanceNumber: value.balanceNumber,
          testFlag: test,
          serialPort: serialPort,
        })
        // console.log(value)
        balanceMap[key].initialize()
        bkup.save(balanceMap[key], balancesPath)
      })
    }
    return
  },
  id: balancesID,
  obj: balanceMap,
  path: balancesPath,
}
