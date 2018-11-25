/// <reference path="./src/typings.d.ts" />
const { readTestUnits } = require('./src/lib');
const { TestEngine } = require('./src/TestEngine');
module.exports = { TestEngine, readTestUnits };
module.exports = Object.assign({}, module.exports, require('./src/jest'));
module.exports = Object.assign({}, module.exports, require('./src/results'));
module.exports.setup = require('./setup');
