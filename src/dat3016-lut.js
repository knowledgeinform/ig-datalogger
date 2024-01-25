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

var dat3016 = {
  'Input Type': {
    Type: ['uint', 'W'],
    Modbus: [11],
    definitions: {
      '50 mV': 0x01,
      '100 mV': 0x02,
      '250 mV': 0x03,
      '1000 mV': 0x04,
      'Tc J': 0x0E,
      'Tc K': 0x0F,
      'Tc T': 0x10,
      'Tc E': 0x11,
      'Tc R': 0x12,
      'Tc S': 0x13,
      'Tc B': 0x14,
      'Tc N': 0x15,
    },
  },
  'Input Value': {
    Type: ['uint', 'R'],
    Modbus: [15, 16, 17, 18],
    decimals: {
      '50 mV': 2,
      '100 mV': 2,
      '250 mV': 2,
      '1000 mV': 1,
      Tc: 1,
    },
  },
}

module.exports = {
  obj: dat3016,
  manual: 'User Guide - MODBUS protocol',
  firmware: '3300',
  revision: 'ED.11.06 REV.02',
  date: 'UNKNOWN',
}
