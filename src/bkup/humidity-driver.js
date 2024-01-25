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

// hello world
// manufacturer: 'Digi International'
//  constructor({portPath, testFlag=true, baud=9600, timing=false, maxQueueLength=100, delimiter='\r', manufacturer, seriallineSerial}) {

const ad = require('./abstract-driver.js')
const Controller = require('./node-pid.js')
const Telnet = require('telnet-client')
const ui = require('./ui.js')
const db = require('./database.js')
const bkup = require('./backup.js')

class HumidityClass {
  constructor({testFlag = false,
    services,
    serverInstance,
    router = '192.12.3.146',
    restartWait = 1000 * 60 * 60 * 4,
    humidityDriverPath,
    server,
  }) {
    server = serverInstance
    this.ID = new ui.ShowUser({value: router}) // for database backup purposes
    this.humidityDriverPath = humidityDriverPath
    this.server = server
    this.restartWait = restartWait // restart Vaisala connection to hopefully 'fix' the timeout issue
    this.testFlag = testFlag
    this.services = services
    this.dflow = 0
    this.CO0 = new ad.DataPoint({units: 'SLPM'})
    this.hflow = 0
    this.numberPVs = 2
    this.numberSPs = 2
    this.PV0 = new ad.DataPoint({value: 0.0, units: 'g/m3'}) // process variable
    this.PV1 = new ad.DataPoint({value: this.dflow + this.hflow, units: 'SLPM'}) // process variable
    this.ctr = new Controller({
      kp: -0.00000000935,
      ki: 0.005,
      kd: 0,
      dt: 1000, // milliseconds
      outMin: 0,
      outMax: 1000,
    })
    this.hSP0 = new ad.DataPoint({value: 0, units: 'g/m3'})
    Object.defineProperty(this, 'SP0', {
      enumerable: true,
      get: () => {
        return this.hSP0
      },
      set: val => {
        this.hSP0.value = val
        this.hSP0.time = Date.now()
        this.ctr.setTarget(this.hSP0.value)
      },
    })
    this.hSP1 = new ad.DataPoint({value: 200, units: 'SCCM'})
    Object.defineProperty(this, 'SP1', {
      enumerable: true,
      get: () => {
        return this.hSP1
      },
      set: val => {
        this.hSP1.value = val
        this.hSP1.time = Date.now()
      },
    })

    this.ctr.setTarget(this.hSP0.value) // % Relative Humidity
    this.checkInterval = 3000 // interval (ms) to wait before checking lastRead
    this.params = {
      host: router,
      port: 23,
      negotiationMandatory: false,
      loginPrompt: 'HMT330 / 5.16',
      timeout: Math.round(this.checkInterval / 2),
    }
    this.connection = new Telnet()
    this.connection.addListener('data', this.process.bind(this))
    this.lastRead = Date.now()
    this.AdditionalFields = {Enable: new ui.ShowUser({value: false, type: ['output', 'binary']})}
    if (this.humidityDriverPath !== undefined) {
      this.AdditionalFields.Database = new ui.ShowUser({
        value: [{
          id: 'Settings',
          obj: {0: new db.GUI({
            measurementName: 'humidity_basic',
            fields: ['SP0',
              'PV0',
              'CO0',
              'SP1',
              'PV1'],
            obj: this,
            testFlag: this.testFlag,
            objPath: this.humidityDriverPath,
          })},
          path: this.humidityDriverPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
        }],
        type: ['output', 'link'],
      })
    }

    // this.initialize()
  }

  Read() {
    // placeholder for now
    // contents got moved to this.connect
  }

  process(d) {
    d = d.toString()
    this.lastRead = Date.now()
    if (d.length < 5) {
      return
    }
    // console.log(d)
    var tempPV = Number(d.substring(51, 57))
    if (isNaN(tempPV)) {
      return
    }
    this.PV0.value = tempPV
    this.PV0.time = Date.now()

    this.CO0.value = this.ctr.update(this.PV0.value)
    this.CO0.time = Date.now()
    if (!isNaN(this.CO0.value)) {
      this.hflow = this.CO0.value
      if (this.hflow > this.SP1.value) {
        this.hflow = this.SP1.value
      }
      if (this.hflow < 0) {
        this.hflow = 0
      }
      this.dflow = this.SP1.value - this.hflow
      if (this.AdditionalFields.Enable.value) {
        this.dryMFCsp(this.dflow)
        this.wetMFCsp(this.hflow)
      }
    }

    this.PV1.value = this.dryMFCmassFlow() + this.wetMFCmassFlow()
    this.PV1.time = Date.now()

    // console.log(d.toString())
    // console.log('PV: '+this.PV0.value.toString())
    // console.log('MV: '+this.CO0.value.toString())
    // console.log('dflow: '+this.dflow.toString())
    // console.log('hflow: '+this.hflow.toString())
  }

  dryMFCsp(val) {
    var call = 'api/MFCs/A/Set Point'
    if (!this.testFlag) {
      this.postVal(call, val)
    }
  }

  wetMFCsp(val) {
    var call = 'api/MFCs/B/Set Point'
    if (!this.testFlag) {
      this.postVal(call, val)
    }
  }

  dryMFCmassFlow() {
    return this.services[1].obj.A['Mass Flow'].value.value
  }

  wetMFCmassFlow() {
    return this.services[1].obj.B['Mass Flow'].value.value
  }

  findSubObj(callkey, obj) {
    var retObj
    // console.log('find subobj')
    if (obj === undefined) {
      return undefined
    }
    Object.entries(obj).forEach(([key, value]) => {
      // console.log(key)
      if (callkey === key) {
        retObj = value
      }
    })
    return retObj
  }

  postVal(call, val) {
    var callParts = call.split('/')
    if (this.testFlag) console.log(callParts)
    // callParts[0] == 'api'
    var topObj
    // var path
    var serviceIndex
    this.services.forEach((item, i) => {
      if (this.testFlag) console.log(item.id)
      if (item.id === callParts[1]) {
        serviceIndex = i
        topObj = item.obj
        // path = item.path
      }
    })
    if (this.testFlag) console.log(topObj)
    var componentObj = this.findSubObj(callParts[2], topObj) // e.g. valves -> 0
    if (this.testFlag) console.log(componentObj)
    var paramObj = this.findSubObj(callParts[3], componentObj) // e.g. valves -> 0 -> State
    if (this.testFlag) console.log(paramObj)
    if (paramObj === undefined) {
      console.log('Invalid API call!')
      console.log('NOT EXECUTING!')
      console.log(call)
      console.log(val)
      return
    }
    if (this.server) {
      this.server.handlePost({
        key: callParts[2],
        value: componentObj,
        subkey: callParts[3],
        subvalue: paramObj,
        service: this.services[serviceIndex],
        body: val,
        res: {
          send: () => {},
          json: () => {},
          status: () => {
            console.log('Mode Post Error')
            return {
              send: error => {
                console.log(error)
              },
            }
          },
        },
        basePath: '', // note: this would need to be filled in to use links
      })
    }
  }

  async connect() {
    try {
      await this.connection.connect(this.params)
      await this.connection.exec('r', {ors: '\r', irs: '\n', shellPrompt: '>', execTimeout: 0})
    } catch (error) {
      console.log('Error connecting to Vaisala RH')
      console.log(error)
      this.destroy()
    }
  }

  async destroy() {
    try {
      await this.connection.end()
      console.log('Ended')
      await this.connection.destroy()
      console.log('Destroyed')
    } catch (error) {
      // handle the throw (timeout)
      console.log(error)
    }
  }

  async keepAlive() {
    setInterval(() => {
      if (Date.now() - this.lastRead > this.checkInterval) {
        // try reconnecting
        this.connect()
      } else {
        // do nothing
      }
    }, this.checkInterval)

    // try forcefully closing the connection to eliminate the timeouts that happen
    setInterval(() => {
      this.destroy()
    }, this.restartWait)
  }

  initialize() {
    if (!this.testFlag) {
      this.connect()
      this.keepAlive()
    }
    // setInterval(() => {
    //     console.log('Enabled')
    //     console.log(this.AdditionalFields.Enable.value)
    // },500)
  }
}

// setTimeout(() => {
//     console.log('Starting')
// },4000)

module.exports = {
  Device: HumidityClass,
}

// async function run() {
//   let connection = new Telnet()
//
//   // these parameters are just examples and most probably won't work for your use-case.
//   let params = {
//     host: '192.12.3.146',
//     port: 23,
//     negotiationMandatory: false,
//     loginPrompt: 'HMT330 / 5.16',
//     timeout: 1500
//   }
//
//   try {
//     await connection.connect(params)
//     console.log('Success')
//     connection.on('data', (d) => {
//       console.log('data event:')
//       console.log(d.toString())
//     })
//     let res = await connection.exec('r',{ors:'\r',irs: '\n',shellPrompt: '>',execTimeout: 0})
//     console.log('async result:', res)
//     // await connection.end()
//     // console.log('Ended')
//     // await connection.destroy()
//     // console.log('Destroyed')
//     // setTimeout(() => {
//     //   connection.exec('')
//     // },2000)
//   } catch(e) {
//     // handle the throw (timeout)
//     console.log(e)
//   }
//
// }
//
// run()
