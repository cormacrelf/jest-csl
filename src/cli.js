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

function getIds(clusters) {
  return Array.prototype.flatMap.call(clusters, cluster => {
    return cluster.map(cite => cite.id);
  });
}

async function runConfiguration(configPath, { includeLibrary, verbose }) {
  let pwd = path.resolve(".");
  let module = path.join(pwd, configPath).replace(/\.js$/, '');
  let config = require(module);
  let outputPath = config.output;
  let { results, engine } = cslTestResults(config);

  let cpath = chalk.white(configPath + ":");
  let output = { units: results };

  if (verbose) {
    let count = 0;
    results.forEach(unit => count += unit.tests && unit.tests.length);
    console.log(cpath, 'processed ' + results.length + ' test units,', count, 'test cases');
  }

  if (includeLibrary) {
    if (verbose) console.log(cpath, 'assembling library')
    let citeIds = new Set();
    results.forEach(unit => {
      unit.tests && unit.tests.forEach((test) => {
        if (test.single && test.single.id) {
          citeIds.add(test.single.id);
        } else if (test.sequence) {
          getIds(test.sequence).forEach(id => id && citeIds.add(id));
        }
      });
    });
    if (verbose) console.log(cpath, 'test used items ' + chalk.blue([...citeIds].join(' ')))
    let library = {};
    [...citeIds].forEach(id => {
      library[id] = engine.retrieveItem(id);
    });
    output.library = library;
  }

  await writeFile(path.join(pwd, outputPath), JSON.stringify(output));
  if (verbose) console.log(cpath, chalk.green('wrote ' + outputPath))
}

