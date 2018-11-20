module.exports = require('./src/lib');
module.exports = Object.assign({}, module.exports, require('./src/jest'));
module.exports = Object.assign({}, module.exports, require('./src/raw'));
module.exports.setup = require('./setup')
