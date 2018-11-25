const CSL = require("citeproc");
const { produce } = require('immer');
const log = require("loglevel")
const { readConfigFiles, readLibrary } = require('./lib');
const { makeSys } = require('./sys');
const { normalizeKey, lookupKey } = require('./getAbbreviation');

function findCitationNode(styleJSON) {
  return styleJSON.children.find(node => {
    return node.name === 'citation';
  });
}

function findLayoutNode(styleJSON) {
  let citation = findCitationNode(styleJSON);
  return citation && citation.children.find(node => {
    return node.name === 'layout';
  });
}

function replaceLayoutWithMacro(styleJson, macroName) {
  return produce(styleJson, (draft) => {
    let layout = findLayoutNode(draft);
    if (!layout) { return null }
    let invoke = { name: 'text', attrs: { macro: macroName }, children: [""] };
    layout.attrs.prefix = "";
    layout.attrs.suffix = "";
    layout.children = [invoke];
  });
}

class TestEngine {
  constructor(args) {
    this.logger = args.logger || log.getLogger('TestEngine');

    let {
      style: styleStr,
      library,
      jurisdictionDirs
    } = readConfigFiles(args);
    let { citations, itemIDs } = readLibrary(library);
    this.itemIDs = itemIDs;

    // parse it so we can manipulate it
    this.style = CSL.parseXml(styleStr);

    this.abbreviations = {};
    this.sysAbbreviationCache = null;

    this.sys = makeSys(
      citations,
      jurisdictionDirs,
      () => this.abbreviations,
      cache => { this.sysAbbreviationCache = cache; }
    );

    this.defaultEngine = new CSL.Engine(this.sys, this.style);
    this.defaultEngine.updateItems(itemIDs);

    this.macroCache = {};
  }

  getEngine(testCase) {
    let engine = this.defaultEngine;
    if (typeof testCase.macro === 'string' && testCase.macro !== "") {
      const { macro } = testCase;
      if (this.macroCache[macro]) {
        return this.macroCache[macro];
      }
      const miniStyle = replaceLayoutWithMacro(this.style, testCase.macro);
      engine = new CSL.Engine(this.sys, miniStyle);
      engine.updateItems(this.itemIDs);
      this.macroCache[testCase] = engine;
    }
    return engine;
  }

  retrieveItem(item) {
    return this.defaultEngine.retrieveItem(item);
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

  _atIndex(c, i) {
    return {
      citationID: "CITATION-"+i,
      properties: { noteIndex: i },
      citationItems: c
    }
  }

  processTestCase(testCase) {
    let engine = this.getEngine(testCase);
    let fmt = testCase.format || 'html';
    if (testCase.single) {
      // engine.makeCitationCluster([single], 'html') is broken, but it's meant to be faster.
      // (it tries to access 'disambig of undefined'... not helpful)
      // (node_modules/citeproc/citeproc_commonjs.js +10874)
      let out = this.produceSequence(engine, [[testCase.single]], fmt, testCase.abbreviations);
      return out[0];
    }
    if (testCase.sequence) {
      return this.produceSequence(engine, testCase.sequence, fmt, testCase.abbreviations);
    }
  }

  produceSequence(engine, clusters, format, abbreviations) {
    this.setAbbreviations(abbreviations);
    let citations = clusters.map((c, i) => this._atIndex(c, i+1))
    let out = engine.rebuildProcessorState(citations, format || 'html')
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
