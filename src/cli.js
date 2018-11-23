#!/usr/bin/env node

const { ensureCachedRepos } = require('./lib');
const { cslTestResults } = require('./results');

const program = require('commander');
const log = require('loglevel');
const chalk = require('chalk');
const fs = require('fs');
require('./log-setup');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);

function collect(val, memo) {
  memo.push(val);
  return memo;
}

program.command('update')
  .description('update the cached CSL locales and style-modules repositories')
  .action(() => {
    return ensureCachedRepos(true)
      .then(() => {
        log.info("Done.")
      });
  });

program.command('results <configurations...>')
  .description('run a test configuration and save the results as JSON in the `output` specified by the configuration')
  .option('-l, --includeLibrary', 'include the library items used in the test suite')
  .option('-v, --verbose', 'log more output')
  .action(async (configurations, args) => {
    if (args.verbose) {
      log.setLevel('debug');
    }
    let exitCode = 0;
    await ensureCachedRepos(false);
    await Promise.all(configurations.map(c => runConfiguration(c, args).catch(e => {
      let ctx = log.getLogger(c);
      ctx.error(e.stack);
      exitCode = 1;
      return Promise.resolve();
    })));
    process.exit(exitCode);
  });

program.parse(process.argv);

async function runConfiguration(configPath, { includeLibrary }) {
  let ctx = log.getLogger(configPath);

  let pwd = path.resolve(".");
  let module = path.join(pwd, configPath).replace(/\.js$/, '');
  let config = require(module);
  let outputPath = config.output;
  ctx.info('began processing');
  let { engine, library, citeIds, units } = cslTestResults(config);

  let count = 0;
  units.forEach(unit => count += unit.tests && unit.tests.length);
  ctx.info('processed ' + units.length + ' test units,', count, 'test cases');
  // ctx.info('test used items ' + chalk.blue(citeIds.join(' ')))

  let output = { units };

  if (includeLibrary) {
    output.library = library;
  }

  await writeFile(path.join(pwd, outputPath), JSON.stringify(output));
  ctx.info(chalk.green('wrote ' + outputPath))
}

