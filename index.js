module.exports = {};
module.exports = Object.assign({}, module.exports, require('./src/jest'));
module.exports = Object.assign({}, module.exports, require('./src/results'));
module.exports.setup = require('./setup')
