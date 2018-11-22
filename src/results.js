const { TestEngine, readTestUnits, normalizeItalics } = require('./lib');

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
  // console.log(engine.locale['en-GB'].terms.page);
  return {
    engine: engine,
    results: rawProcessUnits(engine, units)
  };
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
          let res = engine.produceSingle(test.single, test.format, test.abbreviations);

          _tests.push({ ...test, type: 'single', result: res, passed: normalizeItalics(res) === normalizeItalics(test.expect) });
        } else if (test.sequence && test.expect) {
          let res = engine.produceSequence(test.sequence, test.format, test.abbreviations);
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
