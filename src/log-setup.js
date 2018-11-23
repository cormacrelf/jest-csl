const log = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const chalk = require('chalk');
const colors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red,
};

prefix.reg(log);
log.setLevel('info');
prefix.apply(log, {
  format(level, name, timestamp) {
    // let x = `${chalk.white(`[${timestamp}]`)}`;
    return `${colors[level](level)} ${chalk.white(`${name}:`)}`;
  },
});

