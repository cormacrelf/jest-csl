const { readTestUnits, normalizeItalics } = require('./lib');
const { TestEngine } = require('./TestEngine');

// This generates a JS array of each of the test units, with each test
// transformed to include `result` and whether it `passed`. This is useful for
// generating documentation or making a custom view of the results, a bit like
// a jest reporter but without losing the test case information and metadata.

// args: {
//   csl: string path to a CSL file,
//   libraries: array of string paths to exported CSL-JSON libraries,
//   suites: array of string paths to YAML test suites
// }
function cslTestResults(args) {
  let units = readTestUnits(args.suites);
  let engine = new TestEngine(args);
  let citeIds = getCiteIds(units);
  let library = getLibraryInUse(engine, citeIds);
  units = rawProcessUnits(engine, units);
  return { engine, library, citeIds, units };
}

function stripItems(test) {
  let onlyRequiredProperties = citeItem => {
    const { id, locator, label, prefix, suffix } = citeItem;
    return { id, locator, label, prefix, suffix };
  }

  if (test.single) {
    return { ...test, single: onlyRequiredProperties(test.single) }
  }
  if (test.sequence) {
    return { ...test, sequence: test.sequence.map(cluster => cluster.map(onlyRequiredProperties)) }
  }
  return test;
}

function getIds(clusters) {
  return Array.prototype.flatMap.call(clusters, cluster => {
    return cluster.map(cite => cite.id);
  });
}

function getCiteIds(units) {
  let citeIds = new Set();
  units.forEach(unit => {
    unit.tests && unit.tests.forEach(test => {
      if (test.single && test.single.id) {
        citeIds.add(test.single.id);
      } else if (test.sequence) {
        getIds(test.sequence).forEach(id => id && citeIds.add(id));
      }
    });
  });
  return [...citeIds];
}

function getLibraryInUse(engine, citeIds) {
  let library = {};
  citeIds.forEach(id => {
    library[id] = engine.retrieveItem(id);
  });
  return library;
}

function rawProcessUnits(engine, units) {
  let results = [];
  units.forEach((unit) => {
    let _tests = [];
    if (unit.tests) {
      unit.tests.forEach(test => {
        // TODO: handle skipped tests
        if (test.mode === 'skip') {
          // do nothing
        } else if (test.mode === 'doc') {
          _tests.push({ ...test, type: 'doc', passed: false })
        } else if (!test.expect) {
          _tests.push({ ...test, type: 'stub', passed: false })
        } else if (test.single && test.expect) {
          let res = engine.processTestCase(test);
          test = stripItems(test);
          _tests.push({ ...test, type: 'single', result: res, passed: normalizeItalics(res) === normalizeItalics(test.expect) });
        } else if (test.sequence && test.expect) {
          let res = engine.processTestCase(test);
          test = stripItems(test);
          _tests.push({ ...test, type: 'sequence', result: res, passed: sequenceMatches(test.expect, res) });
        }
      })
    }
    let _u = { ...unit, tests: _tests };
    results.push(_u);
  });
  return results;
}

function sequenceMatches(expected, actual) {
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (normalizeItalics(expected[i]) !== normalizeItalics(actual[i])) return false;
  }
  return true;
}

module.exports = {
  cslTestResults
}
