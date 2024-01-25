///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED "AS IS." JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const {Command, flags} = require('@oclif/command');
const server = require('../server.js');

class ServerCommand extends Command {
  async run() {
    const {flags, args} = this.parse(ServerCommand);
    var startDelay = 4000;
    console.log("Waiting "+(startDelay/1000).toString()+" s for serial devices");

    setTimeout(() => {
      console.log("Starting server with RESTful API");
      console.log(flags.test);
      server.start(args.port, flags.test);
    }, startDelay);

  }
}

ServerCommand.description = `Starts the control-system's RESTful API`;

ServerCommand.examples = [
  `$ control-system server
[log of requests (gets/posts)]`,
];

ServerCommand.flags = {
  help: flags.help({char: 'h'}),
  test: flags.boolean({
    char: 't',
    description: 'run command in "test" mode (run as localhost)',
    default: false,
  }),
};

ServerCommand.args = [{
  name: 'port',
  description: `The server's port number`,
  required: false,
  default: 3000
}];

module.exports = ServerCommand;
