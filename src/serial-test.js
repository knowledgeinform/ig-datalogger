const SerialPort = require('serialport')
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout')

function f() {
  var port = new SerialPort('/dev/tty.usbserial-FT1RX20H', {autoOpen: false, baudRate: 9600})
  var parser = port.pipe(new InterByteTimeout({interval: 200}))

  parser.on('data', function (data) {
    console.log('Data:', data)
  })
  port.open(function (err) {
    if (err) {
      return console.log('Error opening port: ', err.message)
    }

    // Because there's no callback to write, write errors will be emitted on the port:
    setInterval(() => {
      var msg = Buffer.from([0x01, 0x03, 0x00, 0x0A, 0x00, 0x01, 0xA4, 0x08])
      console.log('Writing')
      console.log(msg)
      port.write(msg)
    }, 3000)
  })
}

console.log('Waiting 4 seconds for serial ports')
setTimeout(() => {
  f()
}, 4000)
