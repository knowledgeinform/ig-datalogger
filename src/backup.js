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

const fs = require('fs')

function fileNameInPath(path) {
  var pathParts = path.slice().split('/')
  var lastPart = pathParts[pathParts.length - 1]
  // var buildPath = path
  if (lastPart.includes('.')) {
    return lastPart
  } else {
    return false
  }
}

function checkPath(path) {
  var pathParts = path.slice().split('/')
  var lastPart = pathParts[pathParts.length - 1]
  var buildPath = path
  if (lastPart.includes('.')) {
    buildPath = pathParts.slice(0, -1).join('/')
  }
  return buildPath
}

function createPath(path) {
  var buildPath = checkPath(path)
  console.log('Building path: ' + buildPath)
  fs.mkdirSync(buildPath, {recursive: true})
}

function configurationExists(path) {
  var buildPath = checkPath(path)
  if (fs.existsSync(path)) {
    console.log('Path exists: ' + buildPath)
    return true
  } else {
    console.log('Path not found: ' + buildPath)
    createPath(buildPath)
    return false
  }
}

function loadConfiguration(path) {
  console.log('Attempting to load configuration')
  var loadMap = {}
  var buildPath = checkPath(path)
  var pathFileName = fileNameInPath(path)
  if (pathFileName === false) {
    fs.readdirSync(buildPath, {withFileTypes: true}).forEach((dirent, i) => {
      if (dirent.isFile()) {
        console.log('File ' + i.toString() + ':')
        console.log(dirent.name)
        var contents = fs.readFileSync(buildPath + '/' + dirent.name, 'utf8')
        var obj = JSON.parse(contents)
        // console.log(obj)
        loadMap[dirent.name.slice(0, -5)] = obj
      }
    })
  } else {
    var contents = fs.readFileSync(path, 'utf8')
    var obj = JSON.parse(contents)
    // console.log(obj)
    loadMap[pathFileName.slice(0, -5)] = obj
  }

  return loadMap
}

function fileName(serviceObj) {
  var fName
  if (Object.prototype.hasOwnProperty.call(serviceObj, 'ID')) {
    fName = serviceObj.ID.value
  } else if (Object.prototype.hasOwnProperty.call(serviceObj, 'Mode')) {
    fName = serviceObj.Mode.value
  } else if (Object.prototype.hasOwnProperty.call(serviceObj, 'Index')) {
    fName = serviceObj.Index.value
  } else if (Object.prototype.hasOwnProperty.call(serviceObj, 'Address')) {
    fName = serviceObj.Address.value
  } else {
    var index = 0
    var firstObj = serviceObj[Object.keys(serviceObj)[index]]
    var valueUndefined = true

    while (valueUndefined && firstObj) {
      if (Object.prototype.hasOwnProperty.call(firstObj, 'value')) {
        fName = firstObj.value
        valueUndefined = false
      } else {
        index += 1
        if (index < Object.keys(serviceObj).length) {
          firstObj = serviceObj[Object.keys(serviceObj)[index]]
        } else {
          console.log('No suitable filenames were found')
          console.log(serviceObj)
          valueUndefined = false
        }
      }
    }
  }
  return fName
}

function saveConfiguration(serviceObj, path) {
  // var file = fs.open(mfcsPath+'/'+mfcObj.ID.value+'.json', 'w')
  if (path === undefined) {
    return
  }
  var json = JSON.stringify(serviceObj)
  var fName = fileName(serviceObj)
  var actualPath = checkPath(path)
  var pathFileName = fileNameInPath(path)
  if (pathFileName === false) {
    fs.writeFileSync(actualPath + '/' + fName + '.json', json)
  } else {
    fs.writeFileSync(path, json)
  }
}

module.exports = {
  configExists: configurationExists,
  load: loadConfiguration,
  save: saveConfiguration,
  fileName: fileName,
}
