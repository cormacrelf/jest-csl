#!/usr/bin/env node

const { getDefaultCacheDir, ensureCachedRepos } = require('./lib');

const program = require('commander');
const fs = require('fs');
const path = require('path');

function collect(val, memo) {
  memo.push(val);
  return memo;
}

program.command('update')
  .description('update the cached CSL locales and style-modules repositories')
  .action(() => {
    let cacheDir = getDefaultCacheDir();
    return ensureCachedRepos(cacheDir, true)
      .then(() => {
        console.log("Done.")
      })
  });

program.parse(process.argv);

