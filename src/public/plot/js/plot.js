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
writer Plotly Blob */

var href_parts = window.location.href.split('/')
// console.log(href_parts)
var url = href_parts[0] + '//' + href_parts[2]
var dataPointStreams = {}
var dataPoints = {}
var layout = {}

function getObject(path) {
  return (new Promise((resolve, reject) => {
    const Http = new XMLHttpRequest()
    // console.log('path')
    // console.log(url + path)
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

function trimURL(fullURL) {
  var indexOfQuestionMark = fullURL.indexOf('?')
  var trimmed = fullURL.substring(indexOfQuestionMark + 1)
  console.log(trimmed)
  return trimmed
}

function finddataPointStreams(obj, path) {
  Object.entries(obj).forEach(([key, value], i) => {
    if (Object.prototype.hasOwnProperty.call(value, 'type')) {
      if (value.type[1] === 'datapoint') {
        dataPointStreams[key] = {path: path + '/' + key, enabled: false}
      }
    }
  })
}

function checkLayout(tag) {
  var yaxisLayoutKey = 'yaxis'
  for (var i = 0; i < Object.keys(dataPoints).length; i++) {
    var tmpyLayoutKey = yaxisLayoutKey
    if (i > 0) {
      tmpyLayoutKey += (i + 1).toString()
      if (layout[tmpyLayoutKey] === undefined) {
        console.log('Updating layout for: ' + tmpyLayoutKey)
        layout[tmpyLayoutKey] = {
          title: dataPoints[tag].name,
          anchor: 'free',
          overlaying: 'y',
          side: 'left',
          position: i * 0.07,
        }
      }
    } else {
      // i === 0
      if (layout[tmpyLayoutKey] === undefined) {
        console.log('Initial layout for: ' + tmpyLayoutKey)
        layout[tmpyLayoutKey] = {
          title: dataPoints[tag].name,
        }
      }
    }
  }
}

function updatePlot(obj, tag) {
  // console.log('Updating plot for '+tag)
  if (dataPoints[tag] === undefined) {
    if (Object.keys(dataPoints).length === 0) {
      console.log('initial tag')
      dataPoints[tag] = {
        x: [],
        y: [],
        name: tag + ' (' + obj.value.units + ')',
        type: 'scatter',
      }
    } else {
      console.log('initialization for ' + tag)
      dataPoints[tag] = {
        x: [],
        y: [],
        name: tag + ' (' + obj.value.units + ')',
        yaxis: 'y' + (Object.keys(dataPoints).length + 1).toString(),
        type: 'scatter',
      }
    }
  }
  checkLayout(tag)
  // console.log(tag)
  // console.log(obj)
  // console.log('layout')
  // console.log(layout)
  dataPoints[tag].x.push(obj.value.time)
  dataPoints[tag].y.push(obj.value.value)
  layout.datarevision += 1
  // console.log(Object.values(dataPoints))
  Plotly.react('plotWrapper', Object.values(dataPoints), layout)
}

function toggleEnable(e) {
  var checkBox = e.target
  // console.log(checkBox)
  if (checkBox.checked === true) {
    dataPointStreams[checkBox.id].enabled = true
    dataPointStreams[checkBox.id].timer = setInterval(() => {
      // console.log(dataPointStreams)
      // console.log(checkBox.id)
      getObject(dataPointStreams[checkBox.id].path)
      .then(obj => {
        updatePlot(obj, checkBox.id)
      })
      .catch(error => {
        // console.log('error')
        // console.log(e)
      })
    }, 1000)
  } else {
    dataPointStreams[checkBox.id].enabled = false
    if (dataPointStreams[checkBox.id].timer !== undefined) {
      clearInterval(dataPointStreams[checkBox.id].timer)
    }
  }
  console.log(dataPointStreams[checkBox.id])
}

function addCheckBoxes(name) {
  var lel = document.createTextNode(name)
  // lel.setAttribute('for', name)
  var el = document.createElement('INPUT')
  el.setAttribute('type', 'checkbox')
  el.id = name
  el.onchange = toggleEnable
  // lel.appendChild(el)
  document.getElementById('wrapper').appendChild(lel)
  document.getElementById('wrapper').appendChild(el)
}

function addOptions() {
  // console.log('Adding options')
  Object.keys(dataPointStreams).forEach(name => {
    addCheckBoxes(name)
  })
}

function downloadGraph() {
  var textFile = null
  var data = new Blob([JSON.stringify(dataPoints)], {type: 'text/plain'})

  // If we are replacing a previously generated file we need to
  // manually revoke the object URL to avoid memory leaks.
  if (textFile !== null) {
    window.URL.revokeObjectURL(textFile)
  }

  textFile = window.URL.createObjectURL(data)

  // returns a URL you can use as a href
  // return textFile
  var link = document.getElementById('downloadlink')
  link.href = textFile
  link.style.display = 'block'
}

function addDownloadButton() {
  var btn = document.createElement('BUTTON')
  btn.innerHTML = 'Create Download'
  btn.onclick = downloadGraph
  btn.style.display = 'block'
  document.getElementById('wrapper').appendChild(btn)
  var link = document.getElementById('downloadlink')
  link.addEventListener('click', () => {
    link.style.display = 'none'
  })
}

var fullURL = window.location.href
// console.log(fullURL)

function generateTitle(trimmedPath) {
  var parts = trimmedPath.split('/')
  layout.title = parts[2] + ' ' + parts[3]
  layout.xaxis = {type: 'date'}
  layout.datarevision = 0
  layout.plot_bgcolor = '#444'
  layout.paper_bgcolor = '#0F0F0F'
  layout.font = {
    family: 'Courier, monospace',
    size: 18,
    color: '#5FCEC2',
  }
}

var trimmed = trimURL(fullURL)
generateTitle(trimmed)
getObject(trimmed)
.then(obj => {
  console.log(obj)
  finddataPointStreams(obj, trimmed)
  console.log(dataPointStreams)
  addOptions()
  addDownloadButton()
})
.catch(error => {
  console.log('error')
  console.log(error)
})
