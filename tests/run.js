// Ejecutor de pruebas sin dependencias: node tests/run.js  (Node >= 18)
'use strict';
const fs = require('fs');
const path = require('path');

fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .forEach((f) => require(path.join(__dirname, f)));
