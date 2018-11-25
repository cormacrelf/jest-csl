const CSL = require("citeproc");
const log = require("loglevel")
const { readConfigFiles, readLibrary } = require('./lib');
const { makeSys } = require('./sys');
const { normalizeKey, lookupKey } = require('./getAbbreviation');

class TestEngine {
  constructor(args) {
    this.logger = args.logger || log.getLogger('TestEngine');

    let { style, library, jurisdictionDirs } = readConfigFiles(args);
    let { citations, itemIDs } = readLibrary(library);

    this.abbreviations = {};
    this.sysAbbreviationCache = null;

    const sys = makeSys(
      citations,
      jurisdictionDirs,
      () => this.abbreviations,
      cache => { this.sysAbbreviationCache = cache; }
    );

    this.engine = new CSL.Engine(sys, style);
    this.engine.updateItems(itemIDs);

  }

  retrieveItem(item) {
    return this.engine.retrieveItem(item);
  }

  setAbbreviations(sets) {
    this.abbreviations = {
      default: new CSL.AbbreviationSegments()
    };
    if (this.sysAbbreviationCache) {
      this.logger.trace("clearing sysAbbreviationCache");
      Object.keys(this.sysAbbreviationCache).forEach(k => delete this.sysAbbreviationCache[k]);
      this.sysAbbreviationCache['default'] = new CSL.AbbreviationSegments();
    }
    if (!sets) return;
    sets.forEach(set => {
      let jurisdiction = set.jurisdiction || 'default';
      let categories = Object.keys(new CSL.AbbreviationSegments());
      categories.forEach(cat => {
        let kvs = set[cat] || {};
        Object.entries(kvs).forEach(e => {
          this.addAbbreviation(jurisdiction, cat, e[0], e[1]);
        })
      });
    })
  }

  produceSingle(single, format, abbreviations) {
    // engine.makeCitationCluster([single], 'html') is broken, but it's meant to be faster.
    // (it tries to access 'disambig of undefined'... not helpful)
    // (node_modules/citeproc/citeproc_commonjs.js +10874)
    let out = this.produceSequence([[single]], format || 'html', abbreviations)
    return out[0];
  }

  _atIndex(c, i) {
    return {
      citationID: "CITATION-"+i,
      properties: { noteIndex: i },
      citationItems: c
    }
  }

  produceSequence(clusters, format, abbreviations) {
    this.setAbbreviations(abbreviations);
    let citations = clusters.map((c, i) => this._atIndex(c, i+1))
    let out = this.engine.rebuildProcessorState(citations, format || 'html')
    return out.map(o => o[2]);
  }

  addAbbreviation(jurisdiction, category, key, value) {
    this.logger.info(`adding abbreviation: ${jurisdiction}.${category}["${key}"] = "${value}"`);
    this.abbreviations[jurisdiction] = this.abbreviations[jurisdiction] || new CSL.AbbreviationSegments();
    let k = lookupKey(normalizeKey(key));
    this.abbreviations[jurisdiction][category][k] = value;
  }
}

module.exports = {
  TestEngine,
}
