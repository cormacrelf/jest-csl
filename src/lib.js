Array.prototype.flatMap = function(lambda) { 
    return Array.prototype.concat.apply([], this.map(lambda)); 
};

const log = require('loglevel');
const path = require('path');
const os = require('os');
const osenv = require('osenv');
const uuid = require('uuid');
const yaml = require('js-yaml');
const glob = require('glob');
const xdgBasedir = require('xdg-basedir');
const fs = require('fs');
const fse = require('fs-extra');
const mkdirp = require('mkdirp');
const git = require('nodegit');

function cloneOrPull(url, repoDir, branch, shouldPull) {
  let repo;
  let logger = log.getLogger('ensureCachedRepos');
  return git.Repository.open(repoDir)
    .then(r => { repo = r; })
    .then(async () => {
      if (shouldPull) {
        await repo.fetchAll();
        await repo.mergeBranches(branch, 'origin/' + branch);
        logger.info(`pulled repo ${repoDir}`);
      }
    })
    .catch(async (e) => {
      log.info(`repo ${repoDir} not cached; fetching`)
      await fse.remove(repoDir);
      await git.Clone(url, repoDir);
    })
}

// returns a Promise
async function ensureCachedRepos(shouldPull) {
  let cacheDir = getDefaultCacheDir();
  mkdirp(cacheDir);
  let locales = cloneOrPull("https://github.com/citation-style-language/locales",
    getCacheLoc('locales'),
    'master',
    shouldPull);
  let styleModules = cloneOrPull("https://github.com/Juris-M/style-modules",
      getCacheLoc('style-modules'),
      'master',
      shouldPull);
  await Promise.all([locales, styleModules]);
}

// @param library Array of CSL-JSON item objects.
function readLibrary(library) {
  let citations = {};
  let itemIDs = new Set();
  for (var i=0,ilen=library.length;i<ilen;i++) {
    var item = library[i];
    var id = item.id;
    citations[id] = item;
    itemIDs.add(id);
  }
  return { citations, itemIDs: [...itemIDs] }
}

function _addTestsToMap(m, u) {
  for (let t of u.tests) {
    m.set(t.it, t);
  }
}

function _mergeUnit(a, b) {
  let m = new Map();
  _addTestsToMap(m, a);
  _addTestsToMap(m, b);
  return {
    describe: a.describe,
    tests: [...m.values()]
  }
}

function _addUnitsToMap(m, us) {
  if (!Array.isArray(us)) {
    return;
  }
  for (let u of us) {
    let k = u.describe;
    if (m.has(k)) {
      m.set(k, _mergeUnit(m.get(k), u))
    } else {
      m.set(k, u);
    }
  }
}

function mergeUnits(unitsA, unitsB) {
  let m = new Map();
  _addUnitsToMap(m, unitsA);
  _addUnitsToMap(m, unitsB);
  return [...m.values()];
}

function _bail(msg) {
  log.error(msg);
  process.exit(1);
}

function getDefaultCacheDir() {
  const user = (osenv.user() || uuid.v4()).replace(/\\/g, '');
  let cacheDir = xdgBasedir.cache || path.join(os.tempdir(), user, '.cache')
  cacheDir = path.join(cacheDir, 'jest-csl');
  return cacheDir;
}

function getCacheLoc(r) {
  return path.join(getDefaultCacheDir(), r);
}

function expandGlobs(gs) {
  return (gs || []).flatMap(s => {
    return glob.sync(s);
  });
}

function insertMissingPageLabels(test) {
  let immut = (single) => {
    return (single.locator && !single.label) 
      ? { ... single, label: single.label || 'page' }
      : single;
  };
  if (test.single && test.single.locator && !test.single.label) {
    return { ...test, single: immut(test.single) };
  }
  if (test.sequence) {
    return {
      ...test,
      sequence: test.sequence.map(s => s.map(immut))
    }
  }
  return test;
}


function stripWhitespace(test) {
  let expect = '';
  if (Array.isArray(test.expect)) {
    expect = test.expect.map(e => e.trim());
  } else {
    expect = test.expect && test.expect.trim();
  }
  return {
    ...test,
    expect: test.expect && expect
  }
}

function normalizeItalics(testString) {
  return testString.replace(new RegExp("</i>(\\s*)<i>"), "$1")
}

function readConfigFiles(args) {
  let style = fs.readFileSync(args.csl, 'utf8');
  if (!style) {
    _bail("style not loaded");
  }

  let library = [];

  let libraries = expandGlobs(args.libraries);
  for (var lib of libraries) {
    var libStr = fs.readFileSync(lib, 'utf8');
    if (libStr == null) {
      _bail("library file " + lib + "empty or nonexistent");
    }
    var parsed = JSON.parse(libStr);
    if (!Array.isArray(parsed)) {
      _bail("parsed library not an array of references");
    }
    library = library.concat(parsed);
  }
  if (args.suites.length === 0) {
    _bail('no test args.suites provided');
  }

  let jurisdictionDirs = expandGlobs(args.jurisdictionDirs);

  let out = { style, library, jurisdictionDirs };
  return out;
}

function readTestUnits(suites) {
  let units = [];
  let _suites = expandGlobs(suites);
  for (let suite of _suites) {
    let unitsStr = fs.readFileSync(suite, 'utf8');
    let nxtUnits = yaml.safeLoad(unitsStr);
    units = mergeUnits(units, nxtUnits);
  }
  units = units.map(unit => {
    return {
      ...unit,
      tests: unit.tests.map(stripWhitespace).map(insertMissingPageLabels)
    }
  });
  return units;
}

module.exports = {
  mergeUnits,
  ensureCachedRepos,
  normalizeItalics,
  insertMissingPageLabels,
  readConfigFiles,
  readTestUnits,
  readLibrary,
  getCacheLoc
}

