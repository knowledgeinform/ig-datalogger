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

/* global url document Event flatpickr window XMLHttpRequest fetch streamSaver
writer */

console.log(url)

// const streamSaver = require('StreamSaver')
// const streamSaver = window.streamSaver

String.prototype.toHHMMSS = function () {
  var secNum = parseInt(this, 10) // don't forget the second param
  var hours   = Math.floor(secNum / 3600)
  var minutes = Math.floor((secNum - (hours * 3600)) / 60)
  var seconds = secNum - (hours * 3600) - (minutes * 60)

  if (hours < 10) {
    hours   = '0' + hours
  }
  if (minutes < 10) {
    minutes = '0' + minutes
  }
  if (seconds < 10) {
    seconds = '0' + seconds
  }
  return hours + ':' + minutes + ':' + seconds
}

String.prototype.toMMSS = function () {
  var secNum = parseInt(this, 10) // don't forget the second param
  var minutes = Math.floor(secNum / 60)
  var seconds = secNum - (minutes * 60)

  if (minutes < 10) {
    minutes = '0' + minutes
  }
  if (seconds < 10) {
    seconds = '0' + seconds
  }
  return minutes + ':' + seconds
}

var baseKey = '/api'

var internalEvents = new Event('leavingPage')

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function toDateFormattedString(d) {
  var retString
  retString = months[new Date(Date.parse(d)).getMonth()]
  retString += ' ' + (new Date(Date.parse(d)).getDate()) + ', ' + (new Date(Date.parse(d)).getFullYear())
  // console.log('retString')
  // console.log(retString)
  return retString
}

function toTimeFormattedString(d) {
  var retString
  retString = (new Date(Date.parse(d)).getHours()) + ':' + (new Date(Date.parse(d)).getMinutes())
  return retString
}

function buildDate(day, time) {
  var retString
  retString = toDateFormattedString(day)
  retString += ' ' + toTimeFormattedString(time)
  // console.log(retString)
  var retDate = new Date(retString)
  // console.log(retDate)
  return retDate
}

function sendRange(fRange, fStartT, fEndT, apiServicePath, key) {
  var selectedDates = fRange.selectedDates
  var start = buildDate(new Date(selectedDates[0]), new Date(fStartT.selectedDates[0]))
  var end = buildDate(new Date(selectedDates[1]), new Date(fEndT.selectedDates[0]))
  postToServer(apiServicePath + '/' + key, JSON.stringify({start: start, end: end}), updateData, {path: apiServicePath + '/' + key, prevPath: apiServicePath, subkey: key})
}

function removeOldButtons(obj) {
  obj.forEach((subobj, index) => {
    document.getElementById('btn' + index).remove()
  })
}

function removeAllChildren(myNode) {
  while (myNode.lastElementChild) {
    myNode.removeChild(myNode.lastElementChild)
  }
}

function keyUpFunction(e, cancelBtn) {
  // console.log('keyup detected '+e.keyCode)
  // 27 = ESC key
  // console.log(this)
  if (e.keyCode === 27) {
    e.preventDefault()
    console.log('Canceling form')
    cancelBtn.click()
  }
}

function keyPressFunction(e, enterBtn) {
  // console.log('keypress detected '+e.keyCode)
  if (e.keyCode === 13) {
    e.preventDefault()
    // what to do on submission
    console.log('Submitting form')
    enterBtn.click()
  }
}

// function submitDefPrevent(e) {
//   e.preventDefault()
// }

// function to set up the webpage for interfacing with a service
/**

Key directions:
Ignore:
  'GPIO'
Place on left side:
  default (everything)
Place on right side:
  'State'
  'Type'[0] === 'Output'
    'Type'[1] === binary --> on/off and switch button
    'Type'[1] === number --> number field
    'Type'[1] === string --> character field
  'Type'[0] === 'Input'
    'Type'[1] === binary --> on/off (no switch)
Gets its own div:
  'Type'[0] === 'Input'
    'Type'[1] === number --> plot
    'Type'[1] === string --> text box

Both 'datastreams' and 'updateable' fields are refreshed at some rate

Display in the order received

*/

/*
Executes the action (this function will probably soon be bloated, but it's a place
to start until more formal requirements show themselves).
For now, the main objectives of this function are to run non-standard
procedures. For example:
1. Downloading a file
2. Plotting data
3. (In the future) Adding/removing things associated with services
4. (In the future) Possibly move all the edit button code into here
*/

function execute(action, path, cbargs) {
  console.log(action)
  if (action.name === 'download') {
    download(path)
  } else if (action.name === 'plot') {
    // retrieve data
    // plot in new window
  } else if (action.name === 'post') {
    buttonPost(path, JSON.stringify(action.data), cbargs)
  } else if (action.name === 'formlist') {
    createFormList(action.data, cbargs)
  } else if (action.name === 'formeventlist') {
    createBinaryList(action.data, cbargs)
  } else {
    console.log('UNKNOWN ACTION!')
    console.log(action)
  }
}

function createBinaryList(list, args) {
  var apiServicePath = args.prevPath
  var form = document.createElement('form')
  form.className = 'defaultsForm'
  form.id = apiServicePath + '/' + args.subkey + 'form'
  form.style.top = (Math.round(window.innerHeight / 2) + window.pageYOffset).toString() + 'px'
  form.style.minWidth = '400px'
  form.style.maxWidth = '600px'

  var execEl = document.createElement('p')
  execEl.textContent = 'Events to Delete (select, then click Save)'
  form.appendChild(execEl)

  list.forEach(item => {
    var inputEl = document.createElement('input')
    inputEl.setAttribute('type', 'checkbox')
    inputEl.id = item.call + item.time.toString()
    var labelEl = document.createElement('label')
    labelEl.setAttribute('for', inputEl.id)
    labelEl.innerHTML = translateCall(item.call) + ' ' + translateValue(item.value) + ' at ' + item.time + ' s'
    var breakEl = document.createElement('br')
    form.appendChild(inputEl)
    form.appendChild(labelEl)
    form.appendChild(breakEl)
  })

  createFormButtons(form)
  document.body.appendChild(form)

  form.addEventListener('submit', e => {
    e.preventDefault()
    console.log('Preventing default submission in binary list')
    var indicesToRemove = []
    list.forEach((item, i) => {
      var inputEl = document.getElementById(item.call + item.time.toString())
      // console.log(inputEl)
      console.log(inputEl.checked)
      if (inputEl.checked) {
        indicesToRemove.push(i)
      }
    })
    // other stuff for submitting form
    console.log(indicesToRemove)
    postToServer(apiServicePath + '/' + args.subkey, JSON.stringify(indicesToRemove), displayService, apiServicePath)

    document.body.removeChild(form)
    return false
  }, {once: true})
  return form
}

function getCallPart(str) {
  var listNames = ['Component', 'Item', 'Parameter']
  return listNames.indexOf(str)
}

function formListCB(id, value, displayService, apiServicePath, obj) {
  console.log('inside form list call-back')
  console.log(id)
  console.log(value)
  console.log(obj)

  var parts = id.split('/')
  var lastPart = parts.slice(-1)[0]
  var partNumber = getCallPart(lastPart) + 1
  var currentParts = obj.data.element.call.slice().split('/')
  console.log(currentParts)
  if (partNumber < 1 || partNumber > currentParts.length) {
    console.log('Invalid part number!')
    console.log(partNumber)
    console.log(parts)
  } else {
    if (partNumber === currentParts.length) {
      currentParts.push(value)
    } else {
      currentParts[partNumber] = value
      if (partNumber < currentParts.length - 1) {
        // if it's not the last element, get rid of further elements
        currentParts = currentParts.slice(0, partNumber + 1)
      }
    }
  }
  console.log(currentParts)

  obj.data.element.call = currentParts.join('/')
  // console.log(displayService)
  console.log(apiServicePath)
  createFormList(obj.data, obj.args)
  // alter call to add value, post that call, and re-build formList
}

function createFormList(data, args) {
  var apiServicePath = args.prevPath
  var form
  if (document.getElementById(apiServicePath + '/' + args.subkey + 'form') === null) {
    form = document.createElement('form')
    form.className = 'defaultsForm'
    form.id = apiServicePath + '/' + args.subkey + 'form'
    form.style.top = (Math.round(window.innerHeight / 2) + window.pageYOffset).toString() + 'px'
    form.style.minWidth = '400px'
    form.style.maxWidth = '600px'
    form.addEventListener('submit', e => {
      e.preventDefault()
      console.log('Preventing default submission')
      // other stuff for submitting form
      console.log(data.element)
      postToServer(apiServicePath + '/' + args.subkey, JSON.stringify(data.element), displayService, apiServicePath)

      // cleaning up
      data.element.call = 'api'
      data.element.value = ''
      document.body.removeChild(form)
      return false
    })
    // console.log(window.pageYOffset)
    // console.log(window.innerHeight)

    document.body.appendChild(form)
  } else {
    form = document.getElementById(apiServicePath + '/' + args.subkey + 'form')
    console.log('Removing form children')
    removeAllChildren(form)
  }
  createFormButtons(form)
  var execEl = document.createElement('p')
  execEl.textContent = 'Execution Time (s)'
  form.appendChild(execEl)
  var execTimeEl = createOutputElementsLight(form, {value: data.element.time, type: ['output', 'number']}, apiServicePath + '/' + args.subkey + 'formtime')
  execTimeEl.onchange = () => {
    console.log('Output changed')
    console.log(execTimeEl.value)
    console.log(data.element.time)
    data.element.time = Number(execTimeEl.value)
  }
  // form.style.minWidth =
  var calls = data.element.call.split('/')
  var listNames = ['Component', 'Item', 'Parameter']
  console.log('calls')
  console.log(calls)
  console.log(args)
  var callCat = ''
  var i = 0
  var nextCall = ''
  // var paramEl
  for (var call of calls) {
    if (call !== '') {
      callCat += '/' + call
    }
    console.log(callCat)
    var listTitle
    if (i < listNames.length) {
      listTitle = listNames[i]
    }
    if (calls[i + 1] === undefined) {
      nextCall = ''
    } else {
      nextCall = calls[i + 1]
    }
    console.log(nextCall)
    var lastList
    if (i !== 3) {
      lastList = createListOutput(apiServicePath + '/' + args.subkey + call, listTitle, {value: nextCall}, form, formListCB, {data, args})
      lastList.style.width = '20ch'
    }
    getListFromServer(callCat, lastList, addSpanAndSpacer, 'Description')
    .then(element => {
      console.log('getList finished')
      // replicates what happens during a POST
      // element.value = JSON.stringify(element.value)

      console.log(element)
      if (element !== undefined) {
        console.log(element.checked)
        console.log(element.value)

        assignValue(element, data)
        element.onchange = () => {
          console.log('Changed')
          console.log(element)
          assignValue(element, data)
        }
      }
    })
    .catch(error => {
      console.log('CreateformList error')
      console.log(error)
    })
    form.appendChild(lastList)
    i++
  }
}

function assignValue(element, data) {
  if (element.hasAttribute('type')) {
    if (element.type === 'checkbox') {
      // binary
      console.log('binary')
      data.element.value = element.checked
    } else if (element.type === 'number') {
      // number
      console.log('number')
      data.element.value = Number(element.value)
    } else if (element.type === 'text') {
      // string
      console.log('string')
      data.element.value = element.value
    } else {
      console.log('Uknown element type')
    }
  }
}

function addSpanAndSpacer(obj, key, el) {
  var spanEl = document.createElement('span')
  spanEl.textContent = '  ' + key + ': ' + obj.value
  el.parentNode.appendChild(spanEl)
  var spacer = document.createElement('div')
  // spacer.id = path + 'spacer'
  spacer.className = 'spacer'
  el.parentNode.appendChild(spacer)
}

function buttonPost(path, params, cbargs) {
  var prevPath = cbargs.prevPath
  var subkey = cbargs.subkey
  // var tempBaseKey = path
  const Http = new XMLHttpRequest()
  Http.open('Post', url + path, true)
  Http.setRequestHeader('Content-type', 'application/json')
  console.log(params)
  Http.send(params)
  Http.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      var obj = JSON.parse(Http.response)
      // var element
      // console.log(obj)
      if (obj.type[0] === 'input') {
        createInputElements(obj, prevPath, subkey)
      } else if (obj.type[0] === 'output') {
        console.log('Updating output obj')
        console.log(obj)
        createOutputElements(obj, prevPath, subkey)
      } else {
        console.log('UNKNOWN DATA TYPE')
      }
    } else {
      console.log('Something went wrong with POST :(')
      console.log(this.status)
      console.log(this.readyState)
    }
  }
}

function download(path, action) {
  console.log(path)
  // var tempBaseKey = path
  fetch(url + path, {method: 'POST'}).then(res => {
    console.log('Fetched')
    const fileName = res.headers.get('File-Name')
    console.log(fileName)
    const fileStream = streamSaver.createWriteStream(fileName)
    const readableStream = res.body

    if (window.WritableStream && readableStream.pipeTo) {
      return readableStream.pipeTo(fileStream)
      .then(() => console.log('done writing'))
    }

    window.writer = fileStream.getWriter()

    const reader = res.body.getReader()
    const pump = () => reader.read()
    .then(res => res.done ?
      writer.close() :
      writer.write(res.value).then(pump))

    pump()
  })
}

function postToServer(path, params, cb, cbargs) {
  // var tempBaseKey = path
  const Http = new XMLHttpRequest()
  Http.open('Post', url + path, true)
  Http.setRequestHeader('Content-type', 'application/json')
  console.log(params)
  Http.send(params)
  Http.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      console.log(path)
      console.log(cbargs)
      console.log(cb)
      cb(cbargs)
    } else {
      console.log('Something went wrong with POST :(')
      console.log(this.status)
      console.log(this.readyState)
    }
  }
}

function createOutputElementsLight(parent, value, path) {
  var element
  if (value.type[1] === 'binary') {
    element = createSwitch(path, 'parameter', parent)
  } else if (value.type[1] === 'number') {
    // should be editable number
    element = document.createElement('INPUT')
    element.setAttribute('type', 'number')
    element.setAttribute('step', 'any')
    element.id = path + '/parameter'
    if (typeof value.value === 'number') {
      console.log('Filling in value')
      element.value = value.value
    } else {
      console.log('INCORRECT DATATYPE FOR value.value')
      console.log(value)
      // element.value = key+': '+value.value
    }
    parent.appendChild(element)
  } else if (value.type[1] === 'string') {
    element = document.createElement('input')
    element.setAttribute('type', 'text')
    element.id = path + '/parameter'
    // element.name = key
    // getData({path: apiServicePath+'/'+key, element: element})
    element.value = value.value
    parent.appendChild(element)
  } else if (value.type[1] === 'datapoint') {
    var dptype
    if (typeof value.value.value === 'number') {
      dptype = 'number'
    } else if (typeof value.value.value === 'string') {
      dptype = 'string'
    } else {
      console.log('UNKNOWN DATAPOINT TYPE')
      console.log(value)
    }
    // use this method recursively to add datapoint to page
    element = createOutputElementsLight(parent, {value: value.value.value, type: ['output', dptype]}, path)
  } else if (value.type[1] === 'list') {
    // something possibly in the future
  } else {
    console.log('Unknown value type:')
    console.log(value)
  }
  return element
}

async function getListFromServer(path, listElement, spancb, key) {
  // var tempBaseKey = path
  try {
    var listObj = await getObject(path)
    console.log('listObj')
    console.log(listObj)
    if (Array.isArray(listObj) || !Object.prototype.hasOwnProperty.call(listObj, 'type')) {
      if (!Array.isArray(listObj)) {
        if (Object.prototype.hasOwnProperty.call(listObj, key)) {
          spancb(listObj[key], key, listElement)
        }
        var outputKeys = []
        Object.entries(listObj).forEach(([key, value]) => {
          if (Object.prototype.hasOwnProperty.call(value, 'type')) {
            if (value.type[0] === 'output') {
              outputKeys.push(key)
            }
          }
        })

        listObj = outputKeys
      }
      for (var item of listObj) {
        if (item === listElement.value) {
          // if the item is already in the list, don't add it
        } else {
          var option = document.createElement('option')
          option.value = item
          option.text = item
          listElement.appendChild(option)
        }
      }
      return
    } else {
      if (Object.prototype.hasOwnProperty.call(listObj, 'type')) {
        // something displayable
        console.log('displayable')
        var tEl = createOutputElementsLight(listElement.parentNode, listObj, path)
        console.log(tEl)
        return tEl
      } else {
        console.log('Unknown listObj in getListFromServer')
        console.log(listObj)
        throw new Error('Unknown Object')
      }
    }
  } catch (error) {
    console.log('error')
    console.log(error)
    throw new Error(error)
  }
}

function getElement(path, key, div) {
  var element
  if (document.getElementById(path + '/' + key) === null) {
    element = document.createElement('p')
    element.id = path + '/' + key
    div.appendChild(element)
  } else {
    element = document.getElementById(path + '/' + key)
  }
  return element
}

function getFieldElement(path, key, div) {
  var element
  var p
  if (document.getElementById(path + '/' + key) === null) {
    p = document.createElement('p')
    p.textContent = key + ': '
    element = document.createElement('INPUT')
    element.setAttribute('type', 'number')
    element.setAttribute('step', 'any')
    element.id = path + '/' + key
    element.onchange = () => {
      console.log('Changing ' + key + ' to ' + element.value)
      console.log(path + '/' + key)
      // need to figure out proper callback function: probably createInputElements or createOutputElements :)
      postToServer(path + '/' + key, element.value, updateData, {path: path + '/' + key, prevPath: path, subkey: key})
    }
    p.appendChild(element)

    div.appendChild(p)
  } else {
    element = document.getElementById(path + '/' + key)
  }
  return element
}

function updatePlot(path, key, obj, div) {
  var element
  if (document.getElementById(path + '/plot') === null) {
    // add Plot button
    element = document.createElement('BUTTON')   // Create a <button> element
    element.innerHTML = 'Plot'                   // Insert text
    // subobj is also the next level for api calls
    element.onclick = function () {
      window.open(url + '/plot?' + path)
    }
    element.id = path + '/plot'
    element.className = 'button smallButton' // for styling purposes
    // element.style.width = '7ch'
    div.appendChild(element)
  } else {
    element = document.getElementById(path + '/plot')
  }
  // update object
  // update plot
  return element
}

/**
  Elements/information that the user cannot change
*/

function createInputElements(obj, apiServicePath, key) {
  var lhsDiv = document.getElementById(apiServicePath + '/lhs')
  var rhsDiv = document.getElementById(apiServicePath + '/rhs')
  var element
  // console.log(obj)

  if (obj.type[1] === 'binary') {
    element = getElement(apiServicePath, key, rhsDiv)
    if (obj.value === true) {
      element.textContent = key + ': On'
    } else {
      element.textContent = key + ': Off'
    }
    element.style.textAlign = 'center'
    // var spacer
    // if (document.getElementById(path+'spacer') === null) {
    //   spacer = document.createElement('div')
    //   spacer.id = path+'spacer'
    //   spacer.className = 'spacer'
    //   rhsDiv.appendChild(spacer)
    // }
  } else if (obj.type[1] === 'number') {
    element = getElement(apiServicePath, key, rhsDiv)
    // console.log('Updating number')
    if (typeof obj.value === 'number') {
      element.textContent = key + ': ' + obj.value.toFixed(4)
    } else {
      element.textContent = key + ': ' + obj.value
    }
    if (key === 'Time') {
      overlayProgressBar(element, apiServicePath)
    }
    // element.style.width = (key.length + 8 + 5).toString() + 'ch'
    // console.log(element)
  } else if (obj.type[1] === 'string') {
    if (document.getElementById(apiServicePath + '/' + key) === null) {
      element = createStringElement(apiServicePath, key, obj, lhsDiv)
    } else {
      element = document.getElementById(apiServicePath + '/' + key)
      element.textContent = key + ': ' + obj.value
    }
  } else if (obj.type[1] === 'datapoint') {
    updatePlot(apiServicePath, key, obj, lhsDiv)
    var dptype
    if (typeof obj.value.value === 'number') {
      dptype = 'number'
    } else if (typeof obj.value.value === 'string') {
      dptype = 'string'
    } else {
      console.log('UNKNOWN DATAPOINT TYPE')
      console.log(obj)
    }
    // use this method recursively to add datapoint to page
    element = createInputElements({value: obj.value.value, type: ['input', dptype]}, apiServicePath, key)
    // console.log(element)
    // append the units of the datapoint to the newly created element
    if (element === undefined || element === null) {
      console.log('element UNDEFINED for DATAPOINT')
      console.log(obj)
    } else {
      element.textContent += ' ' + obj.value.units
    }
    // console.log(element)
  } else {
    console.log('UNKNOWN obj type')
    console.log(obj)
  }
  return element
}

function genericButton(apiServicePath, key, element, parentEl) {
  var linkDivWrapper = document.createElement('div')
  linkDivWrapper.style.textAlign = 'center'
  element = document.createElement('BUTTON')   // Create a <button> element
  element.innerHTML = key                // Insert text
  element.className = 'button smallButton' // for styling purposes
  element.id = apiServicePath + '/' + key
  linkDivWrapper.appendChild(element)
  parentEl.appendChild(linkDivWrapper)
  return element
}

function createTimeline(apiServicePath, key, parentEl) {
  console.log('apiServicePath')
  console.log(apiServicePath)
  var wrapperElement = document.createElement('div')
  wrapperElement.id = apiServicePath + '/' + key + 'wrapper'
  wrapperElement.className = 'timelineWrapper clearfix'
  var element = document.createElement('div')
  element.className = 'timeline clearfix'
  element.id = apiServicePath + '/' + key

  wrapperElement.appendChild(element)
  document.getElementById(apiServicePath).appendChild(wrapperElement)
  return element
}

function timelineContains(arrValue, timelineObj, valueIndex) {
  for (var i = 0; i < timelineObj.length; i++) {
    if (timelineObj[i].time.value === Math.round(arrValue.time)) {
      timelineObj[i].time.data.push({display: translateCall(arrValue.call) + ' ' + translateValue(arrValue.value), id: valueIndex})
      return true
    }
  }
  return false
}

function translateCall(call) {
  var callParts = call.slice().split('/')
  console.log(callParts)
  var ret = callParts[1].charAt(0).toUpperCase() + callParts[1].slice(1)
  ret += ' ' + callParts[2] + ' ' + callParts[3]
  return ret
}

function translateValue(value) {
  console.log('Translating')
  console.log(value)
  var parsedVal
  if (value !== undefined && value !== '') {
    try {
      parsedVal = JSON.parse(value)
    } catch (error) {
      console.log('Couldn\'t translate value')
      console.log(value)
    }
  }
  console.log(parsedVal)
  console.log(typeof parsedVal)
  if (typeof parsedVal === 'boolean') {
    console.log('boolean found')
    if (parsedVal) {
      return 'On'
    } else {
      return 'Off'
    }
  } else if (typeof parsedVal === 'number') {
    console.log('number found')
    return value
  } else if (typeof parsedVal === 'string') {
    console.log('string found')
    if (value === '' || value === '\'\'') {
      // don't display the double quotes because they're ugly
      return ''
    } else {
      return value
    }
  } else {
    console.log('else statement')
    return value
  }
}

function fillInTimeline(timeline, object) {
  console.log('Filling in timeline')
  console.log(timeline)
  console.log(object)
  var timelineObj = []
  Object.entries(object).forEach(([key, arrValue], i) => {
    if (!timelineContains(arrValue, timelineObj, i)) {
      timelineObj.push({time: {value: Math.round(arrValue.time), data: [{display: translateCall(arrValue.call) + ' ' + translateValue(arrValue.value), id: i}]}})
    }
  })
  timelineObj.sort((a, b) => {
    return a.time.value - b.time.value
  }) // sort in ascending order
  console.log(timelineObj)
  var tul
  var firstTime = true
  if (document.getElementById(timeline.id + 'timelineList') === null) {
    tul = document.createElement('ul')
    tul.id = timeline.id + 'timelineList'
    tul.className = 'timeline-list clearfix'
    timeline.appendChild(tul)
  } else {
    tul = document.getElementById(timeline.id + 'timelineList')
    removeAllChildren(tul)
    firstTime = false
  }
  var apiServicePath = timeline.id.slice().replace('Sequence', '')
  var totalLength = timeline.clientWidth - 2 // 1px border on each side
  console.log(timeline.clientWidth)
  // console.log(timeline.style.borderLength)
  console.log(totalLength)
  console.log(apiServicePath)
  var durEl = document.getElementById(apiServicePath + 'Duration')
  console.log(durEl)
  var dur
  if (durEl !== null) {
    dur = Number(durEl.textContent.split(' ')[1])
  }
  var oldTotal = 0
  var maxLIs = 0
  var maxLIsEven = 0
  for (var i = 0; i < timelineObj.length; i++) {
    var tli = document.createElement('li')
    tli.innerHTML = timelineObj[i].time.value.toString().toMMSS()
    tli.className = 'timeline-time'

    var teul = document.createElement('ul')
    teul.className = 'timeline-element-list clearfix'
    if (timelineObj[i].time.data.length > maxLIs && (i % 2) === 0) {
      maxLIs = timelineObj[i].time.data.length
    }
    if (timelineObj[i].time.data.length > maxLIsEven && (i % 2) === 1) {
      maxLIsEven = timelineObj[i].time.data.length
    }
    timelineObj[i].time.data.forEach(titem => {
      var teli = document.createElement('li')
      teli.className = 'timeline-element clearfix'
      teli.innerHTML = titem.display
      teul.appendChild(teli)
    })
    tli.appendChild(teul)
    tul.appendChild(tli)
    if (dur !== undefined) {
      // var tliStyle = window.getComputedStyle(tli)
      var tliWidth = Number(tli.offsetWidth)
      // console.log(tliStyle)
      console.log(tli.offsetWidth)
      console.log(tliWidth)
      if (tliWidth === undefined) {
        tli.style.marginLeft = ((timelineObj[i].time.value / dur) * 100).toString() + '%'
      } else {
        if (i === timelineObj.length - 1) {
          // last item, don't divide it's width by 2
          var extraMargin = 1
          tli.style.marginLeft = (((timelineObj[i].time.value / dur) * 100) - oldTotal - (tliWidth / totalLength * 100) - extraMargin).toString() + '%'
        } else {
          tli.style.marginLeft = (((timelineObj[i].time.value / dur) * 100) - oldTotal - (tliWidth / 2 / totalLength * 100)).toString() + '%'
        }

        oldTotal = ((timelineObj[i].time.value / dur) * 100) + (tliWidth / 2 / totalLength * 100)
      }
    }
  }

  // var parentHeight = Number(timeline.parentNode.offsetHeight)
  var clearDiv = document.createElement('div')
  clearDiv.style.clear = 'both'
  // clearDiv.style.height = 'auto'
  // timeline.parentNode.appendChild(clearDiv)
  console.log('maxLIs')
  console.log(maxLIs)
  console.log('maxLIsEven')
  console.log(maxLIsEven)
  var liHeight = 36 // px
  var timelineHeight = 20
  timeline.parentNode.style.height = (timelineHeight + ((maxLIs + maxLIsEven) * liHeight)).toString() + 'px'
  timeline.style.top = (((maxLIs) * liHeight) - timelineHeight).toString() + 'px'
  var lhsDivTemp = document.getElementById(apiServicePath + 'lhs')
  var rhsDivTemp = document.getElementById(apiServicePath + 'rhs')
  var topHeight = lhsDivTemp.offsetHeight
  if (rhsDivTemp.offsetHeight > topHeight) {
    topHeight = rhsDivTemp.offsetHeight
  }
  console.log(topHeight)
  var objDivTemp = document.getElementById(apiServicePath.slice(0, -1))
  console.log(objDivTemp)
  objDivTemp.style.height = (topHeight + timelineHeight + ((maxLIs + maxLIsEven) * liHeight)).toString() + 'px'
  return timeline
}

function createDateRangeOutput(apiServicePath, key, obj, rhsDiv) {
  var dateRangeWrapper = document.createElement('div')
  var element = document.createElement('input')
  element.setAttribute('type', 'text')
  element.id = apiServicePath + '/' + key
  element.style.width = '100%'
  dateRangeWrapper.innerHTML = key + ': '
  var dRangeConfig = {
    mode: 'range',
    // altInput: true,
    // altFormat: 'F j, Y',
    dateFormat: 'F j, Y',
    defaultDate: [toDateFormattedString(obj.value.start), toDateFormattedString(obj.value.end)],
    appendTo: rhsDiv,
  }
  var fRange = flatpickr(element, dRangeConfig)

  var startTime = document.createElement('input')
  startTime.setAttribute('type', 'text')
  startTime.id = apiServicePath + '/' + key + 'startTime'
  var tStartRangeConfig = {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    defaultDate: toTimeFormattedString(obj.value.start),
    appendTo: rhsDiv,
  }
  var fStartT = flatpickr(startTime, tStartRangeConfig)
  startTime.style.width = '45%'

  var endTime = document.createElement('input')
  endTime.setAttribute('type', 'text')
  endTime.id = apiServicePath + '/' + key + 'endTime'
  var tEndRangeConfig = {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    defaultDate: toTimeFormattedString(obj.value.end),
    appendTo: rhsDiv,
  }
  var fEndT = flatpickr(endTime, tEndRangeConfig)
  endTime.style.width = '45%'

  fRange.config.onChange.push((selectedDates, dateStr, instance) => {
    if (selectedDates.length === 2) {
      console.log('2 dates found')
      sendRange(fRange, fStartT, fEndT, apiServicePath, key)
    }
  })
  fStartT.config.onChange.push((selectedTimes, dateStr, instance) => {
    sendRange(fRange, fStartT, fEndT, apiServicePath, key)
  })
  fEndT.config.onChange.push((selectedTimes, dateStr, instance) => {
    sendRange(fRange, fStartT, fEndT, apiServicePath, key)
  })

  // startTime.style.width = '100%'
  // dateRangeWrapper.innerHTML = key+': '

  dateRangeWrapper.appendChild(element)
  dateRangeWrapper.appendChild(startTime)
  dateRangeWrapper.appendChild(endTime)
  rhsDiv.appendChild(dateRangeWrapper)
  return element
}

function createStringElement(apiServicePath, key, obj, lhsDiv) {
  var element
  if (document.getElementById(apiServicePath + '/' + key) === null) {
    element = document.createElement('p')
    element.className = 'displayText'
    element.id = apiServicePath + '/' + key
    lhsDiv.appendChild(element)
  } else {
    element = document.getElementById(apiServicePath + '/' + key)
  }
  element.textContent = key + ': ' + obj.value

  return element
}

function createListOutput(apiServicePath, key, obj, divEl, cb, cbobj) {
  console.log('Creating output list')
  var element = document.createElement('p')
  element.className = 'displayText'
  element.textContent = key
  divEl.appendChild(element)

  element = document.createElement('SELECT')
  element.id = apiServicePath + '/' + key
  element.className = 'dropdown dropdown-dark'

  var option = document.createElement('option')
  option.value = obj.value
  option.text = obj.value
  element.appendChild(option)

  element.value = obj.value
  console.log('element value')
  console.log(obj)
  element.onchange = e => {
    console.log('Change detected')
    // console.log(e)
    cb(element.id, element.value, displayService, apiServicePath, cbobj)
  }
  divEl.appendChild(element)
  return element
}

function createSwitch(apiServicePath, key, parent) {
  var switchDivWrapper = document.createElement('div')
  switchDivWrapper.style.textAlign = 'center'
  switchDivWrapper.style.marginTop = '10px'
  switchDivWrapper.style.marginBottom = '10px'

  var switchEl = document.createElement('label')
  switchEl.className = 'switch'
  // switchEl.style.alignContent = 'center'
  var inputEl = document.createElement('input')
  inputEl.setAttribute('type', 'checkbox')
  inputEl.id = apiServicePath + '/' + key + '/inputEl'
  // inputEl.style.textAlign = 'center'
  switchEl.appendChild(inputEl)

  var spanEl = document.createElement('span')
  // spanEl.style.textAlign = 'center'
  spanEl.className = 'slider round'
  switchEl.appendChild(spanEl)
  switchDivWrapper.appendChild(switchEl)

  parent.appendChild(switchDivWrapper)
  return inputEl
}

function findLongestTime(sequence) {
  var longestTime = 0
  sequence.forEach((item, i) => {
    if (item.time > longestTime) {
      longestTime = item.time
    }
  })
  return longestTime
}

function createUnitsSpan(apiServicePath, key, obj, parent) {
  var units
  if (document.getElementById(apiServicePath + '/' + key + 'unitsspan') === null) {
    units = document.createElement('span')
    units.id = apiServicePath + '/' + key + 'unitsspan'
    parent.appendChild(units)
  } else {
    units = document.getElementById(apiServicePath + '/' + key + 'unitsspan')
  }
  units.textContent = ' ' + obj.value.units
  return units
}

function getDuration(apiServicePath) {
  var el = document.getElementById(apiServicePath + '/Duration')
  if (el === null) {
    return 0
  } else {
    var textContent = el.textContent.split(' ')
    var number = Number(textContent[1])
    console.log(textContent)
    console.log(number)
    return number
  }
}

function appendDuration(element, apiServicePath, key, parent, obj) {
  var longestTime = findLongestTime(obj.value)
  var durElement = createStringElement(apiServicePath, 'Duration', {value: longestTime}, parent)
  durElement.textContent += ' s'
  // getDuration(apiServicePath)
  // createUnitsSpan(apiServicePath, 'Duration', {value: {units: 's'}}, parent)
  return durElement
}

function overlayProgressBar(timeEl, apiServicePath) {
  var durEl = document.getElementById(apiServicePath + '/Duration')
  var timelineEl = document.getElementById(apiServicePath + '/Sequence')
  var time
  var dur
  if (durEl !== null && timelineEl !== null) {
    time = Number(timeEl.textContent.split(' ')[1])
    dur = Number(durEl.textContent.split(' ')[1])
    var el
    if (document.getElementById(apiServicePath + '/Sequenceprogress') === null) {
      el = document.createElement('div')
      el.id = apiServicePath + '/Sequenceprogress'
      el.className = 'progressBar'
      el.style.width = (time / dur * 100).toString() + '%'
      timelineEl.appendChild(el)
    } else {
      el = document.getElementById(apiServicePath + '/Sequenceprogress')
      el.style.width = (time / dur * 100).toString() + '%'
    }
  }
}

/**
  Elements/information that the user could theoretically change
*/

function createOutputElements(obj, apiServicePath, key) {
  var lhsDiv = document.getElementById(apiServicePath + '/lhs')
  var rhsDiv = document.getElementById(apiServicePath + '/rhs')
  var element
  // console.log(obj)

  if (obj.type[1] === 'binary') {
    element = getElement(apiServicePath, key, rhsDiv)
    element.style.textAlign = 'center'
    if (obj.value === false) {
      element.textContent = key + ': Off'
    } else {
      element.textContent = key + ': On'
    }

    // add switch
    var switchEl
    var inputEl
    var spanEl
    if (document.getElementById(apiServicePath + '/' + key + '/inputEl') === null) {
      inputEl = createSwitch(apiServicePath, key, rhsDiv)
    } else {
      inputEl = document.getElementById(apiServicePath + '/' + key + '/inputEl')
    }

    if (obj.value === false) {
      inputEl.checked = false
    } else {
      inputEl.checked = true
    }

    inputEl.onclick = function () {
      // post state to server
      // inputEl.checked
      if (inputEl.checked) {
        // post 1
        postToServer(apiServicePath + '/' + key, inputEl.checked, updateData, {path: apiServicePath + '/' + key, prevPath: apiServicePath, subkey: key})
      } else {
        // post 0
        postToServer(apiServicePath + '/' + key, inputEl.checked, updateData, {path: apiServicePath + '/' + key, prevPath: apiServicePath, subkey: key})
      }
      // get results (update div element)
    }
  } else if (obj.type[1] === 'number') {
    // should be editable number
    element = getFieldElement(apiServicePath, key, rhsDiv)
    if (typeof obj.value === 'number') {
      // if-statement allows user to type without it being updated from a poll
      if (element !== document.activeElement) element.value = obj.value
    } else {
      console.log('INCORRECT DATATYPE FOR obj.value')
      console.log(obj)
      // element.value = key+': '+obj.value
    }
  } else if (obj.type[1] === 'string') {
    // should be an editable-field
    if (document.getElementById(apiServicePath + '/' + key) === null) {
      element = createStringElement(apiServicePath, key, obj, lhsDiv)
    } else {
      element = document.getElementById(apiServicePath + '/' + key)
      element.textContent = key + ': ' + obj.value
    }
  } else if (obj.type[1] === 'list') {
    if (document.getElementById(apiServicePath + '/' + key) === null) {
      element = createListOutput(apiServicePath, key, obj, lhsDiv, postToServer)
      getListFromServer(apiServicePath + '/' + key + 'list', element)
    } else {
      element = document.getElementById(apiServicePath + '/' + key)
      // console.log('Found list')
      // console.log(element)
      element.value = obj.value
      // element.textContent = key + ': ' + obj.value
    }
  } else if (obj.type[1] === 'datapoint') {
    var dptype
    if (typeof obj.value.value === 'number') {
      dptype = 'number'
    } else if (typeof obj.value.value === 'string') {
      dptype = 'string'
    } else {
      console.log('UNKNOWN DATAPOINT TYPE')
      console.log(obj)
    }
    // use this method recursively to add datapoint to page
    element = createOutputElements({value: obj.value.value, type: ['output', dptype]}, apiServicePath, key)
    // console.log(element)
    // append the units of the datapoint to the newly created element
    if (element === undefined || element === null) {
      console.log('element UNDEFINED for DATAPOINT')
      console.log(obj)
    } else {
      var units
      if (document.getElementById(apiServicePath + '/' + key + 'unitsspan') === null) {
        units = document.createElement('span')
        units.id = apiServicePath + '/' + key + 'unitsspan'
        element.parentElement.appendChild(units)
      } else {
        units = document.getElementById(apiServicePath + '/' + key + 'unitsspan')
      }
      units.textContent = ' ' + obj.value.units
    }
    // console.log(element)
  } else if (obj.type[1] === 'link') {
    // should be an editable-field
    if (document.getElementById(apiServicePath + '/' + key) === null) {
      element = genericButton(apiServicePath, key, element, rhsDiv)
      // subobj is also the next level for api calls
      element.onclick = function () {
        document.getElementById('wrapper').dispatchEvent(internalEvents)
        postToServer(element.id, '', function (path) {
          removeAllChildren(document.getElementById('wrapper'))
          console.log(path)
          getButtonServices(path)
        }, apiServicePath + '/' + key + '/link')

        // create overlay with keys and values that can be edited
        // createOverlay(obj, apiServicePath)
      }
    } else {
      element = document.getElementById(apiServicePath + '/' + key)
    }
  } else if (obj.type[1] === 'dateRange') {
    if (flatpickr !== undefined) {
      if (document.getElementById(apiServicePath + '/' + key) === null) {
        element = createDateRangeOutput(apiServicePath, key, obj, rhsDiv)
      } else {
        element = document.getElementById(apiServicePath + '/' + key)
        var startTimet = document.getElementById(apiServicePath + '/' + key + 'startTime')
        var endTimet = document.getElementById(apiServicePath + '/' + key + 'endTime')
        element._flatpickr.setDate([toDateFormattedString(obj.value.start), toDateFormattedString(obj.value.end)])
        startTimet._flatpickr.setDate(toTimeFormattedString(obj.value.start))
        endTimet._flatpickr.setDate(toTimeFormattedString(obj.value.end))
      }
    }
  } else if (obj.type[1] === 'button') {
    if (document.getElementById(apiServicePath + '/' + key) === null) {
      element = genericButton(apiServicePath, key, element, rhsDiv)
    } else {
      element = document.getElementById(apiServicePath + '/' + key)
    }
    element.onclick = () => {
      execute(obj.value, apiServicePath + '/' + key, {path: apiServicePath + '/' + key, prevPath: apiServicePath, subkey: key}) // obj.value = action
    }
  } else if (obj.type[1] === 'timeline') {
    if (document.getElementById(apiServicePath + '/' + key) === null) {
      element = createTimeline(apiServicePath, key, lhsDiv)
      overlayProgressBar(element, apiServicePath)
      // appendDuration(element, apiServicePath, key, lhsDiv, obj)
    } else {
      element = document.getElementById(apiServicePath + '/' + key)
    }
    fillInTimeline(element, obj.value)
  } else {
    console.log('UKNOWN object type:')
    console.log(obj)
  }
  return element
}

function updateData({path, prevPath, subkey}) {
  var tempBaseKey = path
  getObject(path)
  .then(obj => {
    var element
    // console.log(obj)
    if (obj.type[0] === 'input') {
      createInputElements(obj, prevPath, subkey)
    } else if (obj.type[0] === 'output') {
      // console.log('Updating output obj')
      // console.log(obj)
      createOutputElements(obj, prevPath, subkey)
    } else {
      console.log('UNKNOWN DATA TYPE')
    }
  })
  .catch(error => {
    console.log('error')
    console.log(error)
  })
}

function getData({path, element}) {
  console.log('Getting data from: ' + path)
  var tempBaseKey = path
  getObject(path)
  .then(obj => {
    console.log(obj)
    if (obj.type[1] === 'datatpoint') {
      if (obj.value.value === undefined) {
        console.log('Undefined datapoint value')
      } else {
        element.value = obj.value.value
      }
    } else {
      if (obj.value === undefined) {
        console.log('Undefined value')
      } else {
        element.value = obj.value
      }
    }
    // console.log(obj)
    if (obj.type[0] === 'input') {
      console.log('Getting input data')
    } else if (obj.type[0] === 'output') {
      console.log('Getting output data')
    } else {
      console.log('UNKNOWN DATA TYPE')
    }
  })
  .catch(error => {
    console.log('error')
    console.log(error)
  })
}

function createFormButtons(form) {
  var btn = document.createElement('BUTTON')   // Create a <button> element
  btn.innerHTML = 'Save'                   // Insert text
  // subobj is also the next level for api calls
  btn.onclick = function () {
    // actually send the new values over...
    // form.submit()
  }
  // btn.id = 'btn'+index
  btn.className = 'button editButton' // for styling purposes
  btn.style.width = '7ch'

  var cancelBtn = document.createElement('BUTTON')
  cancelBtn.innerHTML = 'Cancel'
  cancelBtn.onclick = function () {
    document.body.removeChild(form)
  }
  cancelBtn.className = 'button editButton'
  cancelBtn.style.width = '7ch'

  var centeringEl = document.createElement('p')
  centeringEl.style.textAlign = 'center'
  centeringEl.appendChild(btn)
  centeringEl.appendChild(cancelBtn)
  form.addEventListener('keypress', e => {
    keyPressFunction(e, btn)
  }, {once: true})
  form.addEventListener('keyup', e => {
    keyUpFunction(e, cancelBtn)
  }, {once: true})

  form.appendChild(centeringEl)               // Append <button> to <body>
}

function createOverlay(obj, apiServicePath) {
  var form = document.createElement('form')
  form.className = 'defaultsForm'
  Object.entries(obj).forEach(([key, value]) => {
    var el
    if (value.type !== undefined) {
      if (value.type[0] === 'output') {
        if (value.type[1] === 'binary') {
          // stuff for binary
        } else if (value.type[1] === 'number') {
          // stuff for number
        } else if (value.type[1] === 'string') {
          el = document.createElement('p')
          // el.id = apiServicePath+'/'+key
          el.textContent = key + ': '
          var elInput = document.createElement('input')
          elInput.setAttribute('type', 'text')
          elInput.id = apiServicePath + '/' + key
          elInput.name = key
          getData({path: apiServicePath + '/' + key, element: elInput})
          // elInput.value = value.value
          el.appendChild(elInput)
        } else if (value.type[1] === 'datapoint') {
          // datapoint stuff
        } else if (value.type[1] === 'list') {
          // list stuff
        } else {
          console.log('Unknown value type:')
          console.log(value)
        }
      }
    }

    if (el !== undefined) {
      form.appendChild(el)
    }
  })
  form.addEventListener('submit', e => {
    e.preventDefault()
    console.log('Preventing default submission')
    var list = form.getElementsByTagName('input')
    // console.log(list)
    for (var node of list) {
      console.log(node.id)
      console.log(node.value)
      var keyList = node.id.split('/')
      var key = keyList[keyList.length - 1]
      console.log(key)
      console.log(apiServicePath)
      postToServer(node.id, node.value, updateData, {path: node.id, prevPath: apiServicePath, subkey: key})
    }
    document.body.removeChild(form)
    return false
  }, {once: true})
  createFormButtons(form)
  form.style.top = (Math.round(window.innerHeight / 2) + window.pageYOffset).toString() + 'px'
  // console.log(window.pageYOffset)
  // console.log(window.innerHeight)

  document.body.appendChild(form)
}

function createEditButton(div, obj, apiServicePath) {
  var btn = document.createElement('BUTTON')   // Create a <button> element
  btn.innerHTML = 'Edit'                   // Insert text
  // subobj is also the next level for api calls
  btn.onclick = function () {
    // create overlay with keys and values that can be edited
    createOverlay(obj, apiServicePath)
  }
  // btn.id = 'btn'+index
  btn.className = 'button editButton' // for styling purposes
  div.appendChild(btn)               // Append <button> to <body>
}

function displayService(apiServicePath) {
  var tempBaseKey = apiServicePath
  getObject(apiServicePath)
  .then(obj => {
    var objDiv
    var lhsDiv
    var rhsDiv
    if (document.getElementById(apiServicePath) === null) {
      objDiv = document.createElement('div')
      // some unique identifier that could be re-found <-- doesn't work for bus services
      // objDiv.id = 'subservice'+obj.GPIO
      objDiv.id = apiServicePath

      objDiv.className = 'subserviceClass clearfix' // styling
      // var borderWrapper = document.createElement('div')
      // borderWrapper.className = 'subserviceClassBorder'
      // borderWrapper.appendChild(objDiv)
      document.getElementById('wrapper').appendChild(objDiv)

      var splitDivWrapper = document.createElement('div')
      splitDivWrapper.className = 'splitWrapper clearfix'
      lhsDiv = document.createElement('div')
      lhsDiv.id = apiServicePath + '/lhs'
      lhsDiv.className = 'lhsdivClass'

      splitDivWrapper.appendChild(lhsDiv)

      rhsDiv = document.createElement('div')
      rhsDiv.id = apiServicePath + '/rhs'
      rhsDiv.className = 'rhsdivClass'

      splitDivWrapper.appendChild(rhsDiv)
      var clearDiv = document.createElement('div')
      clearDiv.style.clear = 'both'
      splitDivWrapper.appendChild(clearDiv)
      objDiv.appendChild(splitDivWrapper)

      createEditButton(lhsDiv, obj, apiServicePath)
    } else {
      objDiv = document.getElementById(apiServicePath)
      lhsDiv = document.getElementById(apiServicePath + '/lhs')
      rhsDiv = document.getElementById(apiServicePath + '/rhs')

      // remove all 'old' children
      // while (objDiv.firstChild) {
      //   objDiv.removeChild(objDiv.firstChild)
      // }
    }

    Object.entries(obj).forEach(([key, value]) => {
      // check right side
      var element
      if (key === 'datastreams') {
        // ignore these
      } else if (key === 'updateable') {
        // note: this can only be ONE key in the object because otherwise, multiple intervals will be set
        // update these on the refreshrate
        var upTimer = setInterval(() => {
          obj.updateable.forEach((subkey, index) => {
            // console.log(apiServicePath+'/'+subkey)
            updateData({path: apiServicePath + '/' + subkey, prevPath: apiServicePath, subkey: subkey})
            // .catch((e) => {
            //   console.log('upTimer error')
            // })
          })
        }, obj.datastreams.refreshRate)
        document.getElementById('wrapper').addEventListener('leavingPage', () => {
          clearInterval(upTimer)
        }, {once: true})
        window.addEventListener('popstate', () => {
          clearInterval(upTimer)
        }, {once: true})
      } else {
        if (value.type !== undefined) {
          if (value.type[0] === 'output' && key !== 'GPIO') {
            element = createOutputElements(value, apiServicePath, key)
          } else if (value.type[0] === 'input') {
            console.log('Input found')
            element = createInputElements(value, apiServicePath, key)
            if (Object.prototype.hasOwnProperty.call(obj, 'nonupdateable')) {
              if (obj.nonupdateable.includes(key)) {
                console.log(element)
                return // skips over setting up the interval timers
              }
            }
            console.log('Setting up timers')
            var inputTimer = setInterval(() => {
              updateData({path: apiServicePath + '/' + key, prevPath: apiServicePath, subkey: key})
            }, obj.datastreams.refreshRate)
            document.getElementById('wrapper').addEventListener('leavingPage', () => {
              clearInterval(inputTimer)
            }, {once: true})
            window.addEventListener('popstate', () => {
              clearInterval(inputTimer)
            }, {once: true})
          }
          console.log(element)
        }

        // var spacer = document.createElement('div')
        // spacer.className = 'spacer'
        // lhsdiv.appendChild(spacer)
      }
      // check div
      // default: left side
    })
  })
  .catch(error => {
    console.log('error')
    console.log(error)
  })
}

function getSubServices(path) {
  var tempBaseKey = path
  getObject(path)
  .then(obj => {
    console.log(obj)
    obj.forEach((subobj, index) => {
      displayService(tempBaseKey + '/' + subobj)
    })
  })
  .catch(error => {
    console.log('error')
    console.log(error)
  })
}

function getObject(path) {
  return (new Promise((resolve, reject) => {
    const Http = new XMLHttpRequest()
    // console.log('path')
    // console.log(path)
    Http.open('Get', url + path)
    Http.send()
    Http.onreadystatechange = () => {
      if (Http.readyState === 4 && Http.status === 200) {
        // console.log(Http.response)
        resolve(JSON.parse(Http.response))
      } else {
        // console.log('readyState')
        // console.log(Http.readyState)
        // console.log(Http.status)
      }
    }
  }))
}

function getButtonServices(path) {
  var tempBaseKey = path
  var btndiv = document.createElement('div')
  btndiv.id = 'buttondiv'
  btndiv.className = 'buttondivClass'
  document.getElementById('wrapper').appendChild(btndiv)
  getObject(path)
  .then(obj => {
    window.history.pushState({path: baseKey, cb: 'getButtonServices', pageTitle: document.title}, '')
    // var btnPrototype = document.getElementById('btn0')
    // btnPrototype.innerHTML = obj[0]

    // what to append all the buttons to
    obj.forEach((subobj, index) => {
      var btn = document.createElement('BUTTON')   // Create a <button> element
      btn.innerHTML = decodeURI(subobj).charAt(0).toUpperCase() + decodeURI(subobj).slice(1)                   // Insert text
      // btn.action = tempBaseKey+'/'+subobj
      // subobj is also the next level for api calls
      btn.onclick = function () {
        removeOldButtons(obj)
        btndiv.remove()
        tempBaseKey = tempBaseKey + '/' + subobj

        console.log('tempBaseKey')
        console.log(tempBaseKey)
        // document.getElementById('content').innerHTML = response.html
        document.title = decodeURI(subobj).charAt(0).toUpperCase() + decodeURI(subobj).slice(1)
        window.history.pushState({path: tempBaseKey, cb: 'getSubServices', pageTitle: document.title}, '', tempBaseKey)

        getSubServices(tempBaseKey)
      }
      btn.id = 'btn' + index
      btn.className = 'button' // for styling purposes
      btndiv.appendChild(btn)               // Append <button> to <body>
    })
    console.log(obj)
  })
  .catch(error => {
    console.log('error')
    console.log(error)
  })
}

window.onpopstate = function (e) {
  console.log('popping')
  console.log(e)
  if (e.state) {
    console.log('State change occurred')
    console.log(e.state)
    if (e.state.pageTitle !== undefined) {
      document.title = e.state.pageTitle
    }
    if (e.state.cb === 'getButtonServices') {
      removeAllChildren(document.getElementById('wrapper'))
      getButtonServices(e.state.path)
    } else if (e.state.cb === 'getSubServices') {
      removeAllChildren(document.getElementById('wrapper'))
      getSubServices(e.state.path)
    }
    // document.getElementById('content').innerHTML = e.state.html
    // document.title = e.state.pageTitle
  }
}

var a = document.createElement('a')
a.innerHTML = 'IG Datalogger'
a.title = url
a.href = url
a.className = 'bigInfo'
document.getElementById('header-info-wrapper').appendChild(a)

getButtonServices(baseKey)
