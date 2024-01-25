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

const SerialPort = require('serialport')
const CustomParser = require('@serialport/parser-readline')
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout')
const EventEmitter = require('events')
// const util = require('util')
// const stream = require('stream')
// const fs = require('fs')

var PortList = ['NONE']
var PortArray = []

async function updatePorts() {
  // console.log('Updating ports')
  SerialPort.list()
  .then(list => {
    PortList = ['NONE']
    PortArray = list
    list.forEach(port => {
      PortList.push(port.path)
    })
  })
  .catch(error => {
    console.log('UpdatePorts Error')
    console.log(error)
  })
}

updatePorts()

setInterval(() => {
  updatePorts()
}, 15000)

/**
 * Represents a a serial port. Defaults to 9600 baud
 * @constructor
 * @param {string} portPath - The path to the port (e.g. '/dev/tty.usbserial')
 * @param {boolean} testFlag - Flag denoting wether or not to actually use serial port (Default false)
 */

class Router extends EventEmitter {
  constructor({
    portPath,
    testFlag = true,
    baud = 9600,
    timing = false,
    timeInterval = 50,
    maxQueueLength = 100,
    delimiter = '\r',
    manufacturer,
    seriallineSerial,
    dataBits = 8,
  }) {
    super()
    this.setMaxListeners(26)
    // 26 per number of alicats on a single serial (plus, in general,
    // you probably shouldn't have more than 26 devices on a serial)

    if (testFlag === undefined) {
      testFlag = false
    }
    Object.defineProperty(this, 'portArray', {
      get: () => {
        return PortArray
      },
    })
    Object.defineProperty(this, 'PortList', {
      get: () => {
        return PortList
      },
    })
    this.queue = []
    this.dataBits = dataBits
    this.maxQueueLength = maxQueueLength
    this.seriallineSerial = seriallineSerial
    console.log('router')
    console.log(testFlag)
    this.manufacturer = manufacturer
    // this.portPath = portPath
    this.originalPortPath = portPath
    this.goodPorts = this.findPort(portPath)
    console.log('goodPorts')
    console.log(this.goodPorts)
    this.portIndex = 0
    this.portPath = this.goodPorts[this.portIndex]
    console.log('portPath')
    console.log(this.portPath)
    this.baud = baud
    this.timing = timing
    this.timeInterval = timeInterval
    this.delimiter = delimiter
    this.testFlag = testFlag
    this.open = false

    if (!this.testFlag && this.portAvailable(this.portPath)) {
      // while (this.tryAgain) {
      // this.openPort()
      // }
    } else {
      this.open = false
      this.portPath = 'NONE'
      this.parser = new EventEmitter()
    }
  }

  openPort() {
    console.log('opening port: ' + this.goodPorts[this.portIndex])
    return new Promise(resolve => {
      this.port = new SerialPort(this.portPath,
        {baudRate: this.baud,
          dataBits: this.dataBits,
        },
        error => {
          if (error === null) {
            console.log('Serial port ' + this.portPath + ' is open!')
            console.log('Original port Path: ' + this.originalPortPath)
            console.log(resolve)
            if (this.timing) {
              this.parser = this.port.pipe(new InterByteTimeout({interval: this.timeInterval}))
            } else {
              this.parser = this.port.pipe(new CustomParser({delimiter: this.delimiter}))
            }
            // wrapper for 'data' event which causes the stream to open
            // this.parser.on('data', d => {
            //   this.emit('data', d)
            // })
            this.open = true
            this.emit('open')
            return resolve()
          } else {
            console.log('Error on port: ' + this.portPath)
            console.log(error)
            if (this.portIndex + 1 < this.goodPorts.length) {
              this.portIndex++
              console.log('Trying again: ' + this.goodPorts[this.portIndex])
              this.portPath = this.goodPorts[this.portIndex]
              return resolve(this.openPort())
            } else {
              this.emitError('Failed to open port ' + this.portPath)
              this.parser = new EventEmitter()
              return resolve()
            }
          }
        })
    })
  }

  findPort(portPath) {
    console.log('Searching for ' + portPath)
    var pa = this.portArray
    console.log(this.portArray)
    console.log(this.manufacturer)
    if (pa && this.manufacturer) {
      var validPorts = []
      var serialMatch
      for (var port of pa) {
        if (port.manufacturer === this.manufacturer) {
          validPorts.push(port.path)
          console.log('seriallineSerial: ' + this.seriallineSerial)
          console.log('port.serialNumber: ' + port.serialNumber)
          if (this.seriallineSerial === port.serialNumber) {
            console.log('Found serial line serial number')
            serialMatch = validPorts.length - 1
          }
        }
      }
      this.reorder(validPorts, serialMatch)
      validPorts.push('NONE')
      console.log(validPorts)
      return validPorts
    } else {
      return [portPath, 'NONE']
    }
  }

  reorder(validPorts, serialMatchIndex) {
    if (serialMatchIndex !== undefined) {
      console.log('Reordering serial ports')
      validPorts.splice(0, 0, validPorts.splice(serialMatchIndex, 1)[0])
    }
  }

  reopen({portPath, testFlag, baud, timing, maxQueueLength, delimiter}) {
    if (this.portAvailable(this.portPath) || portPath === 'NONE') {
      this.queue.splice(0, this.queue.length)
    }

    if (this.port !== undefined) {
      this.open = false
      if (this.port.isOpen) {
        this.port.close()
      }
      // this.parser.removeAllListeners('data')
    }
    if (timing !== undefined) {
      this.timing = timing
    }
    if (maxQueueLength !== undefined) {
      this.maxQueueLength = maxQueueLength
    }
    if (delimiter !== undefined) {
      this.delimiter = delimiter
    }
    if (portPath !== undefined) {
      this.portPath = portPath
    }
    if (testFlag !== undefined) {
      this.testFlag = testFlag
    }
    if (baud !== undefined) {
      this.baud = baud
    }

    console.log('reopening router')
    console.log(this.testFlag)

    if (!this.testFlag && this.portAvailable(this.portPath)) {
      try {
        this.port = new SerialPort(this.portPath, {baudRate: this.baud, autoOpen: this.autoOpen}, error => {
          if (error === null) {
            console.log('Serial port ' + this.portPath + ' is open!')
            this.open = true
            if (this.timing) {
              this.parser = this.port.pipe(new InterByteTimeout({interval: 50}))
            } else {
              this.parser = this.port.pipe(new CustomParser({delimiter: this.delimiter}))
            }
          } else {
            console.log('Error on port: ' + this.portPath)
            console.log(error)
            this.emitError('Failed to open port' + this.portPath)
          }
        })
      } catch (error) {
        this.emitError('Failed to open port' + this.portPath)
        console.log(error)
        this.open = false
        this.portPath = 'NONE'
        this.parser = new EventEmitter()
      }
    } else {
      this.open = false
      this.portPath = 'NONE'
      this.parser = new EventEmitter()
    }
  }

  emitError(arg) {
    this.emit('router_error', arg)
  }

  close() {
    if (this.port !== undefined) {
      this.open = false
      if (this.port.isOpen) {
        this.port.close()
      }
      this.parser = new EventEmitter()
      this.emit('closed')
      // this.parser.removeAllListeners('data')
    }
  }

  portAvailable(portPath) {
    if (portPath === 'NONE') {
      return false
    } else {
      return PortList.includes(portPath)
    }
  }
}

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

class DataPoint {
  constructor({value = 0, units = '', time}) {
    this.value = value
    this.units = units
    this.time = ((time === undefined) ? Date.now() : time)
  }
}

class SerialControl {
  constructor({router, testFlag, debugTest, timeout = 100, interMessageWait = 0}) {
    this.testFlag = testFlag
    this.interMessageWait = interMessageWait
    this.debugTest = debugTest
    if (debugTest === undefined) this.debugTest = false

    this.timeout = timeout // ms
    this.router = router
    Object.defineProperty(this, 'testFlag', {
      get: () => {
        if (this.router) {
          return !this.router.open
        } else {
          return true
        }
      },
    })
    this.resp = []
    this.addChunk = chunk => {
      this.resp.push(chunk)
      if (this.debugTest) console.log(`${chunk}`)
      if (this.endTimer !== undefined) {
        this.endTimer.refresh()
      }
    }
  }

  /**
   * Serial-line write call-back function that clears the 'resp' Array property
   * before the serial-line read function has a chance to add to it.
   */
  writecb() {
    this.resp = []
    // console.log('Done writing')
  }

  /**
   * Asynchronous serial-line parser-listener that
   * before the serial-line read function has a chance to add to it.
   * @param {boolean} multiple - indicates whether the response should be single-line or multi-line (single-line can return faster) (Default false)
   * @param {string} command - The serial line command originally sent (optiona) (useful for debugging)
   * @param {number} customTimeout - A custom timeout period (ms) to wait for a response (important for commands that take longer to process, e.g. setGas)
   */

  end(multiple, command, customTimeout) {
    if (this.testFlag) {
      return new Promise(resolve => {
        resolve()
      })
    }
    var timeout = this.timeout // ms
    if (customTimeout !== undefined) {
      timeout = customTimeout
    }
    return new Promise((resolve, reject) => {
      if (multiple === undefined || multiple === false) {
        // console.log(this.testFlag)
        // just a single-line response
        this.router.parser.once('error', error => {
          // cleanup the listeners
          var dataListeners = this.router.parser.listeners('data')
          if (dataListeners.length > 0) {
            // console.log('removing data listener single')
            this.router.parser.removeListener('data', dataListeners[dataListeners.length - 1])
          }
          if (this.endTimer !== undefined)
            clearTimeout(this.endTimer)
          reject(error)
          return
        }) //
        // endTimer set before-hand to ensure it's not undefined
        this.endTimer = setTimeout(() => {
          if (command) {
            console.log('Timeout command single:')
            console.log(command)
          }
          var errorListeners = this.router.parser.listeners('error')
          // console.log(errorListeners)
          if (errorListeners.length > 0) {
            // console.log('removing error listener single')
            this.router.parser.removeListener('error', errorListeners[errorListeners.length - 1])
          }

          var dataListeners = this.router.parser.listeners('data')
          // console.log(dataListeners)
          if (dataListeners.length > 0) {
            // console.log('removing data listener single')
            this.router.parser.removeListener('data', dataListeners[dataListeners.length - 1])
          }

          if (this.testFlag) {
            return
          } else {
            console.log('Timeout completed single')
            // console.log(this.resp)
            // console.log(this.router.parser.listeners('error'))
            // console.log(this.router.parser.listeners('data'))
            reject(new Error('Timeout'))
            return
          }
        }, timeout)
        this.router.parser.once('data', chunk => {
          this.resp.push(chunk)
          if (this.debugTest) console.log(`${chunk.toString('hex')}`)
          // console.log(argument.callee)
          // cleanup the listeners
          var errorListeners = this.router.parser.listeners('error')
          // console.log(errorListeners)
          if (errorListeners.length > 0) {
            // console.log('removing error listener single')
            this.router.parser.removeListener('error', errorListeners[errorListeners.length - 1])
          }
          // cleanup the timers too
          clearTimeout(this.endTimer)
          if (this.debugTest) console.log('this.resp')
          if (this.debugTest) console.log(this.resp)
          resolve(this.resp.slice())
          return
        })
      } else {
        // multiple line response
        if (this.debugTest) console.log('found multiple')
        // if (this.debugTest) console.log('timeout ' + timeout)

        this.router.parser.once('error', error => {
          // cleanup the listeners
          console.log('multiple error')
          console.log(error)
          this.router.parser.removeListener('data', this.addChunk)
          if (this.endTimer)
            clearTimeout(this.endTimer)
          reject(error)
          return
        })
        // endTimer set before-hand to ensure it's not undefined
        this.endTimer = setTimeout(() => {
          if (this.debugTest) console.log('Timeout completed multiple')
          if (this.debugTest && command) console.log(command)
          // console.log(this)
          // cleanup the listeners
          var errorListeners = this.router.parser.listeners('error')
          // console.log(errorListeners)
          if (errorListeners.length > 0) {
            console.log('removing error listener multiple')
            this.router.parser.removeListener('error', errorListeners[errorListeners.length - 1])
          }
          this.router.parser.removeListener('data', this.addChunk)
          if (this.resp.length === 0) {
            if (this.debugTest) console.log('Rejection multiple')
            reject(new Error('Timeout'))
            return
          } else {
            if (this.debugTest) console.log('Resolving')
            resolve(this.resp.slice())
            return
          }
        }, timeout)

        this.router.parser.on('data', this.addChunk)
      }
    })
  }

  /**
  This is the function that actually writes to the serial line and issues the
  callback function that clears DeviceMFC.resp
  */

  async serialTx(command) {
    if (this.debugTest) console.log('Serialtx')
    if (this.debugTest) console.log(command)
    try {
      if (!this.testFlag) {
        await this.router.port.write(command, this.writecb())
      }
    } catch (error) {
      console.log(error)
      throw error
    }
    return
  }

  interMessageDelay() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, this.interMessageWait)
    })
  }

  serial(command, multi, timeout) {
    if (this.router.queue.length > this.router.maxQueueLength) {
      console.log('Too many router commands queued for ' + this.router.portPath)
      console.log('Queue size: ' + this.router.maxQueueLength)
      throw new Error('Too many router commands queued')
    } else {
      if (this.debugTest) {
        console.log('queue length')
        console.log(this.router.queue.length)
        console.log('Command')
        console.log(command)
        var dataListeners = this.router.parser.listeners('data')
        console.log('data event listener length')
        console.log(dataListeners.length)
      }
    }
    var lastPromise = this.router.queue[this.router.queue.length - 1]
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
        var indexOfLP = this.router.queue.indexOf(lastPromise)
        if (indexOfLP >= 0) {
          // console.log('removing last promise')
          // remove the last Promise from the queue
          this.router.queue.splice(indexOfLP, 1)
        } else {
          throw new Error('Big problem in router queue where last promise could not be found')
        }
      } else {
        console.log('last promise not defined')
      }

      var resp
      await this.serialTx(command)
      resp = await this.end(multi, command, timeout)
      if (this.debugTest) console.log('serial resp')
      if (this.debugTest) console.log(resp)
      return resp
    }
    // console.log('pushing promise onto queue')
    this.router.queue.push(cmdPromise(lastPromise))

    return this.router.queue[this.router.queue.length - 1]
  }
}

module.exports = {
  Router: Router,
  DataPoint: DataPoint,
  SerialControl: SerialControl,
}
