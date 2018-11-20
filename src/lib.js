Array.prototype.flatMap = function(lambda) { 
    return Array.prototype.concat.apply([], this.map(lambda)); 
};

const CSL = require("citeproc");
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
  return git.Repository.open(repoDir)
    .then(r => { repo = r; })
    .then(() => {
      if (shouldPull) {
        return Promise.resolve()
        .then(() => repo.fetchAll())
        .then(() => repo.mergeBranches(branch, 'origin/' + branch))
      }
    })
    .catch((e) => {
      console.log('error opening repository '+repoDir+'. starting from scratch:', e);
      return fse.remove(repoDir)
        .then(() => git.Clone(url, repoDir));
    })
    .then(() => {
      if (shouldPull) {
        console.log("Updated", repoDir);
      }
    })
}

// returns a Promise
function ensureCachedRepos(shouldPull) {
  let cacheDir = getDefaultCacheDir();
  mkdirp(cacheDir);
  return Promise.resolve()
    .then(() => cloneOrPull("https://github.com/citation-style-language/locales",
                            _cacheLoc('locales'),
                            'master',
                            shouldPull))
    .then(() => cloneOrPull("https://github.com/Juris-M/style-modules",
                            _cacheLoc('style-modules'),
                            'master',
                            shouldPull))
  ;
}

// function _fallback(repo, file) {
//     var xhr = new XMLHttpRequest();
//     xhr.open('GET', `https://raw.githubusercontent.com/${repo}/master/${file}`, false);
//     xhr.send(null);
//     return xhr.status === 200 && xhr.responseText;
// }

const citeprocSys = (citations, jurisdictionDirs) => ({
  retrieveLocale: function (lang) {
    // console.log('language:', lang);
    let p = path.join(_cacheLoc('locales'), 'locales-'+lang+'.xml');
    let locale = fs.readFileSync(p, 'utf8')
    return locale;
  },

  retrieveItem: function(id){
    return citations[id];
  },

  retrieveStyleModule: function(jurisdiction, preference) {
    jurisdiction = jurisdiction.replace(/\:/g, "+");
    var id = preference
      ? "juris-" + jurisdiction + "-" + preference + ".csl"
      : "juris-" + jurisdiction + ".csl";
    let shouldLog = false;
    let tryFile = (x) => {
      if (shouldLog) console.log('searching', x);
      let t = fs.readFileSync(x, 'utf8')
      if (t && shouldLog) console.log('found', x)
      return t;
    }
    jurisdictionDirs.push(_cacheLoc('style-modules'));
    let ord = jurisdictionDirs
      .map(d => () => tryFile(path.join(d, id)));
    let ret = false;
    for (var i = 0; i < ord.length; i++) {
      try {
        ret = ord[i]();
        if (ret) {
          return ret;
        };
      } catch (e) {
        continue;
      }
    }
    return ret;
  }
});

// @param library Array of CSL-JSON item objects.
function _readLibrary(library) {
  let citations = {};
  let itemIDs = new Set();
  for (var i=0,ilen=library.length;i<ilen;i++) {
    var item = library[i];
    var id = item.id;
    citations[id] = item;
    itemIDs.add(id);
  }
  return [citations, [...itemIDs]]
}

function getProcessor(styleStr, library, jurisdictionDirs = []) {
  let [citations, itemIDs] = _readLibrary(library);
  var proc = new CSL.Engine(citeprocSys(citations, jurisdictionDirs), styleStr);
  proc.updateItems(itemIDs);
  return proc;
};

function produceSingle(engine, single) {
  // engine.makeCitationCluster([single], 'html') is broken, but it's meant to be faster.
  // (it tries to access 'disambig of undefined'... not helpful)
  // (node_modules/citeproc/citeproc_commonjs.js +10874)
  let out = produceSequence(engine, [{ cluster: [single]}])
  return out[0];
}

function _atIndex(c, i) {
  return {
    citationID: "CITATION-"+i,
    properties: { noteIndex: i },
    citationItems: c.cluster
  }
}

function produceSequence(engine, clusters) {
  let citations = clusters.map((c, i) => _atIndex(c, i+1))
  let out = engine.rebuildProcessorState(citations, 'html')
  return out.map(o => o[2]);
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
  console.error(msg);
  process.exit(1);
}

function getDefaultCacheDir() {
  const user = (osenv.user() || uuid.v4()).replace(/\\/g, '');
  let cacheDir = xdgBasedir.cache || path.join(os.tempdir(), user, '.cache')
  cacheDir = path.join(cacheDir, 'jest-csl');
  return cacheDir;
}

function _cacheLoc(r) {
  return path.join(getDefaultCacheDir(), r);
}

function expandGlobs(gs) {
  return (gs || []).flatMap(s => {
    return glob.sync(s);
  });
}

function readInputFiles(args) {
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
  let units = [];
  let suites = expandGlobs(args.suites);
  for (let suite of suites) {
    let unitsStr = fs.readFileSync(suite, 'utf8');
    let nxtUnits = yaml.safeLoad(unitsStr);
    units = mergeUnits(units, nxtUnits);
  }

  let jurisdictionDirs = expandGlobs(args.jurisdictionDirs);

  let out = { style, library, units, jurisdictionDirs };
  return out;
}

module.exports = {
  mergeUnits,
  getProcessor,
  produceSingle,
  produceSequence,
  ensureCachedRepos,
  readInputFiles,
}

