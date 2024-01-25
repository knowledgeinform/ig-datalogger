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

const express = require('express')
const fs = require('fs')
// const EventEmitter = require('events')
const path = require('path')

const thermometers = require('./thermometers.js')
const balances = require('./balances.js')
const timers = require('./timers.js')
const adcs = require('./pressure.js')
const mfcs = require('./mfc.js')
const ards = require('./arduino-stepper.js')
const datexel = require('./datexel.js')

const bkup = require('./backup.js')
var baseServices = [datexel, thermometers, balances, ards]

// class Eemitter extends EventEmitter {}

// const state = new Eemitter()

// 192.building.floor.room
const ipAddress = '192.168.1.2'
// const ipAddress = 'localhost'
var baseAPIPath = '/api/'
// var basePath = ''
var consoleTest = false

const app = express()

app.use(express.static('public'))

// make way for some custom css, js and images
app.use('/css', express.static(path.join(__dirname, '/public/css')))
app.use('/js', express.static(path.join(__dirname, '/public/js')))
app.use('/images', express.static(path.join(__dirname, '/public/images')))

function isSetter(obj, prop) {
  return Boolean(Object.getOwnPropertyDescriptor(obj, prop).set)
}

function handlePost({key, value, subkey, subvalue, service, body, res, basePath}) {
  // check subvalue datatype (e.g. Set Point)
  console.log('body')
  console.log(body)
  console.log(key)
  console.log(subkey)
  console.log(subvalue)
  if (subvalue.type) {
    console.log('type defined')
    // check the type
    if (subvalue.type[0] === 'output') {
      console.log('type output')
      if (subvalue.type[1]) {
        console.log('second type defined')
        switch (subvalue.type[1]) {
        case 'binary':
          // console.log(body)
          if (body === 'true') {
            // console.log('boolean detected')
            if (isSetter(value, subkey)) {
              // onsole.log('getter setter')
              service.obj[key][subkey] = true
            } else {
              service.obj[key][subkey].value = true
            }

            bkup.save(service.obj[key], service.path)
            res.send()
          } else if (body === 'false') {
            // console.log('boolean detected')
            if (isSetter(value, subkey)) {
              service.obj[key][subkey] = false
            } else {
              service.obj[key][subkey].value = false
            }
            bkup.save(service.obj[key], service.path)
            res.send()
          } else if (typeof body === 'number') {
            service.obj[key][subkey].value = parseInt(body, 10)
            bkup.save(service.obj[key], service.path)
            res.send()
          } else if (typeof body === 'string') {
            if (body === 'on' || body === 'On') {
              service.obj[key][subkey].value = 1
              bkup.save(service.obj[key], service.path)
              res.send()
            } else if (body === 'off' || body === 'Off') {
              service.obj[key][subkey].value = 0
              bkup.save(service.obj[key], service.path)
              res.send()
            } else {
              return res.status(400).send({
                message: 'Unknown binary string type request',
              })
            }
          } else {
            return res.status(400).send({
              message: 'Unknown binary request: Neither number nor string',
            })
          }
          break
        case 'number':
          if (isSetter(value, subkey)) {
            if (consoleTest) console.log('setter')
            service.obj[key][subkey] = parseFloat(body)
          } else {
            if (consoleTest) console.log('not setter')
            service.obj[key][subkey].value = parseFloat(body)
          }
          bkup.save(service.obj[key], service.path)
          res.send()
          break
        case 'string':
          if (consoleTest) console.log('string found')
          if (isSetter(value, subkey)) {
            if (consoleTest) console.log('setter')
            service.obj[key][subkey] = body
          } else {
            if (consoleTest) console.log('not setter')
            service.obj[key][subkey].value = body
          }
          // console.log(key)
          // console.log(subkey)
          // console.log(service)
          bkup.save(service.obj[key], service.path)
          res.send()
          break
        case 'datapoint':
          if (typeof subvalue.value.value === 'number') {
            if (consoleTest) console.log('datapoint number found')
            if (isSetter(value, subkey)) {
              if (consoleTest) console.log('setter')
              service.obj[key][subkey] = parseFloat(body)
            } else {
              if (consoleTest) console.log('not setter')
              service.obj[key][subkey].value.value = parseFloat(body)
            }
            bkup.save(service.obj[key], service.path)
            res.send()
          } else if (typeof subvalue.value.value === 'string') {
            if (consoleTest) console.log('datapoint string found')
            service.obj[key][subkey] = body
            bkup.save(service.obj[key], service.path)
            res.send()
          } else {
            console.log('Unknown data point type')
            console.log(subvalue)
            return res.status(400).send({
              message: 'Unknown data point type',
            })
          }
          break
        case 'list':
          // I don't like the duplicate code from 'datapoint' to 'list', so remove in the future
          if (typeof subvalue.value === 'number') {
            if (isSetter(value, subkey)) {
              service.obj[key][subkey] = parseFloat(body)
            } else {
              service.obj[key][subkey].value = parseFloat(body)
            }
            bkup.save(service.obj[key], service.path)
            res.send()
          } else if (typeof subvalue.value === 'string') {
            if (consoleTest) console.log('Found list string')
            if (isSetter(value, subkey)) {
              if (consoleTest) console.log('setter')
              service.obj[key][subkey] = body
            } else {
              if (consoleTest) console.log('not setter')
              service.obj[key][subkey].value = body
            }

            bkup.save(service.obj[key], service.path)
            res.send()
          } else {
            console.log('Unknown list type')
            console.log(subvalue)
            return res.status(400).send({
              message: 'Unknown list type',
            })
          }
          break
        case 'link':
          if (consoleTest) console.log('link found')
          if (consoleTest) console.log(subvalue)
          if (Array.isArray(service.obj[key][subkey].value)) {
            // for array, assume an array of services just like the initial object
            var linkURL = basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey) + '/link/'
            if (consoleTest) console.log(linkURL)
            res.send()
            initializeAPI(subvalue.value, linkURL)
          } else {
            if (consoleTest) console.log('Uknown link type')
            if (consoleTest) console.log(service.obj[key][subkey])
            return res.status(400).send({
              message: 'Unknown link type',
            })
          }
          break
        case 'dateRange':
          var dateRangeBody = JSON.parse(body)
          service.obj[key][subkey].value.start = dateRangeBody.start
          service.obj[key][subkey].value.end = dateRangeBody.end
          res.send()
          break
        case 'button':
          // buttons will always be getter/setters due to their
          // abstract nature
          service.obj[key][subkey] = {res, body}
          break
        default:
          return res.status(400).send({
            message: 'subvalue type is unknown: ' + subvalue.type[1],
          })
        }
      } else {
        return res.status(400).send({
          message: 'Subvalue type has no defined value',
        })
      }
    } else if (subvalue.type[0] === 'input') {
      // cannot change inputs
      console.log('Cannot change \'input\' types')
      return res.status(400).send({
        message: 'Cannot change \'input\' types',
      })
    } else {
      // unknown data type
      console.log('Subvalue type is neither \'output\' nor \'input\': ' + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + subkey)
      console.log(subvalue)
      return res.status(400).send({
        message: 'Subvalue type is neither \'output\' nor \'input\'',
      })
    }
  } else {
    return res.status(400).send({
      message: 'Subvalue type not defined',
    })
  }
  if (consoleTest) console.log(service.obj[key][subkey])
  if (consoleTest) console.log(body)
  // res.json(value)
}

/*
allServices -- array of objects that contain both 3 important properties: obj, id, and path
if path is NOT defined, the bkup.save will silently fail, which can be very convenient
*/

function initializeAPI(allServices, basePath) {
  /**
  Receives data from a client via post for subkey (e.g. mfc/1/Set Point)
  */
  // console.log(allServices[5].obj['1'].hidden.property.get('gasList'))
  allServices.forEach(service => {
    if (service.obj !== undefined) {
      Object.entries(service.obj).forEach(([key, value]) => {
        Object.entries(value).forEach(([subkey, subvalue]) => {
          // console.log('initializing api posts')
          // console.log(basePath+encodeURIComponent(service.id)+'/'+encodeURIComponent(key)+'/'+encodeURIComponent(subkey))
          app.post(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey), function (req, res) {
            // console.log(req.params)
            // console.log(req)
            var body = []
            req.on('data', chunk => {
              body.push(chunk)
            }).on('end', () => {
              body = Buffer.concat(body).toString()
              console.log((service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey))
              console.log('Handling: ' + body)
              handlePost({
                key: key,
                value: value,
                subkey: subkey,
                subvalue: subvalue,
                service: service,
                body: body,
                res: res,
                basePath: basePath,
              })
            })
          })
        })
      })
    }
  })

  /**
  Sends data (from data sources) within div elements
  */
  allServices.forEach(service => {
    // console.log('service: '+service.id)
    // console.log(service)
    if (service.obj !== undefined) {
      Object.entries(service.obj).forEach(([key, value]) => {
        // console.log('service: '+service.id)
        Object.entries(value).forEach(([subkey, subvalue]) => {
          // console.log('service: '+service.id)
          if (subvalue.type !== undefined) {
            if (subvalue.type[1] !== 'list') {
              // if (consoleTest) console.log(basePath+encodeURIComponent(service.id)+'/'+encodeURIComponent(key)+'/'+encodeURIComponent(subkey))
              // if (consoleTest) console.log(value)
              // if (consoleTest) console.log(subvalue)
              if (consoleTest) console.log(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey))
              app.get(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey), function (req, res) {
                res.json(service.obj[key][subkey])
                // if (consoleTest) console.log('Got request')
                // if (consoleTest) console.log(subkey)
                // if (consoleTest) console.log(value)
                // if (consoleTest) console.log(value[subkey])
              })
            } else if (subvalue.type[1] === 'list') {
              /**
              Lists require more data
              */

              // console.log('Found list: '+subkey)
              // console.log(basePath+encodeURIComponent(service.id)+'/'+encodeURIComponent(key)+'/'+encodeURIComponent(subkey+'list'))
              // console.log(value[subkey+'list'])
              app.get(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey + 'list'), function (req, res) {
                res.json(service.obj[key][subkey + 'list'])
              })
              app.get(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey), function (req, res) {
                res.json(service.obj[key][subkey])
              })
            } else {
              console.log('Unknown subvalue type:')
              console.log(service.obj[key][subkey])
            }
          }
        })
        if (value.datastreams !== undefined) {
          // console.log('Intiailizing datastreams')

          // the datastreams 'get' might need to change
          Object.entries(value.datastreams).forEach(([subkey, subvalue]) => {
            // console.log(subkey)
            app.get(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subkey), function (req, res) {
              res.json(subvalue)
            })
          })

          Object.entries(value.updateable).forEach(([, subvalue]) => {
            // console.log(subvalue)
            // console.log(value[subvalue])
            // console.log(basePath+encodeURIComponent(service.id)+'/'+encodeURIComponent(key)+'/'+subvalue)
            // console.log(basePath+encodeURIComponent(service.id)+'/'+encodeURIComponent(key)+'/'+encodeURIComponent(subvalue))
            app.get(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(subvalue), function (req, res) {
              // subvalue in this case is the subkey, since updateable is an array
              res.json(service.obj[key][subvalue])
              // console.log('Got request')
            })
          })
        }
      })
    }
  })

  /**
  Fills in the div elements
  <br> (client should probably also understand datastreams)
  */
  allServices.forEach(service => {
    console.log(encodeURIComponent(service.id))
    if (service.obj !== undefined) {
      Object.entries(service.obj).forEach(([key]) => {
        app.get(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key), function (req, res) {
          // if (consoleTest) console.log('Getting '+key)
          // console.log(service.obj[key])
          res.json(service.obj[key])
        })
      })
    }
  })

  /**
  WARNING: DEPRECATED in favor of generic post calls AND WILL BE REMOVED SOON
  Performs actions on div elements/performs actions on services (via service.setOutput)
  */
  allServices.forEach(service => {
    if (service.obj !== undefined) {
      Object.entries(service.obj).forEach(([key, value]) => {
        app.post(basePath + encodeURIComponent(service.id) + '/' + encodeURIComponent(key), function (req, res) {
          // console.log(req.params)
          // console.log(req)
          var body = []
          req.on('data', chunk => {
            body.push(chunk)
          }).on('end', () => {
            body = Buffer.concat(body).toString()
            if (consoleTest) console.log(body)
            // this is where the actual change happens
            service.setOutput(key, body)
            res.json(value)
          })
        })
      })
    }
  })

  /**
  Sends all the necessary calls for essentially entire pages
  */
  allServices.forEach(service => {
    app.get(basePath + encodeURIComponent(service.id), function (req, res) {
      var nextLevelCalls = []
      if (service.obj !== undefined) {
        Object.entries(service.obj).forEach(([key]) => {
          nextLevelCalls.push(key)
        })
        res.json(nextLevelCalls)
      }
    })
  })

  app.get(basePath, function (req, res) {
    var nextLevelCalls = []
    allServices.forEach(service => {
      nextLevelCalls.push(encodeURIComponent(service.id))
    })
    res.json(nextLevelCalls)
  })

  // added to eliminate the favicon request error for the GUI
  // app.get('/favicon.ico', (req, res) => res.status(204))

  app.get('/api/hello', function (req, res) {
    res.end('Hello there')
  })
}

function prependAPIURL(url) {
  var file = 'public/js/url.js'
  try {
    fs.unlinkSync(file)
    // file removed
  } catch (error) {
    console.log('file probably already deleted')
    console.error(error)
  }
  var fd = fs.openSync(file, 'w')
  var buffer = Buffer.from('const url=\'' + url + '\'\n')

  fs.writeSync(fd, buffer, 0, buffer.length, 0) // write new data
  // or fs.appendFile(fd, data)
  fs.closeSync(fd)
}

function reinit() {
  // basePath = baseAPIPath
  initializeAPI(baseServices, baseAPIPath)
}

async function serviceInitialize(testFlag, thisObj) {
  for (var service of baseServices) {
    try {
      await service.initialize(testFlag, reinit, baseServices, thisObj)
    } catch (error) {
      console.log('intiailization error')
      console.log(error)
    }
  }
  baseServices.push(timers)
  try {
    await timers.initialize(testFlag, baseServices, thisObj)
    console.log('Done initializing timers')
  } catch (error) {
    console.log('timers intiailization error')
    console.log(error)
  }
  console.log('Really intiailizing the API')
  initializeAPI(baseServices, baseAPIPath)
}

module.exports = {
  start: async function (port, testFlag) {
    consoleTest = true
    try {
      await serviceInitialize(testFlag, this)
    } catch (error) {
      console.log('Service initialization error')
      console.log(error)
    }

    var addr
    if (testFlag) {
      addr = 'localhost'
    } else {
      addr = ipAddress
    }
    var url = `http://${addr}:${port}`
    prependAPIURL(url)
    app.listen(port, addr, error => {
      if (error) {
        return console.log('something bad happened', error)
      }

      console.log(`Server running at http://${addr}:${port}`)
    })
  },
  handlePost: handlePost,
}
