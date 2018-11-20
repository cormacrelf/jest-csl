#!/usr/bin/env node

const { ensureCachedRepos } = require('./lib');
const program = require('commander');

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

program.parse(process.argv);

