#!/usr/bin/env node

const { ensureCachedRepos } = require('./lib');
const { cslTestResults } = require('./results');

const program = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
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
        console.log("Done.")
      })
  });

program.command('results <configurations...>')
  .description('run a test configuration and save the results as JSON in the `output` specified by the configuration')
  .option('-l, --includeLibrary', 'include the library items used in the test suite')
  .option('-v, --verbose', 'log more output')
  .action((configurations, args) => {
    return Promise.all(configurations.map(c => runConfiguration(c, args).catch(e => {
      console.error(chalk.bold.red("Error running configuration", c));
      console.error(e.stack);
      return Promise.resolve();
    })))
  });

program.parse(process.argv);

async function runConfiguration(configPath, { includeLibrary, verbose }) {
  let pwd = path.resolve(".");
  let module = path.join(pwd, configPath).replace(/\.js$/, '');
  let config = require(module);
  let outputPath = config.output;
  let { engine, library, citeIds, units } = cslTestResults(config);

  let cpath = chalk.white(configPath + ":");

  if (verbose) {
    let count = 0;
    units.forEach(unit => count += unit.tests && unit.tests.length);
    console.log(cpath, 'processed ' + units.length + ' test units,', count, 'test cases');
    console.log(cpath, 'test used items ' + chalk.blue(citeIds.join(' ')))
  }

  let output = { units };

  if (includeLibrary) {
    output.library = library;
  }

  await writeFile(path.join(pwd, outputPath), JSON.stringify(output));
  if (verbose) console.log(cpath, chalk.green('wrote ' + outputPath))
}

