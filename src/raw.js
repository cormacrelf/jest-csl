const { getProcessor, produceSingle, produceSequence, readInputFiles } = require('./lib');

// args: {
//   csl: string path to a CSL file,
//   libraries: array of string paths to exported CSL-JSON libraries,
//   suites: array of string paths to YAML test suites
// }
function cslTestResults(args) {
  let { style, library, units, jurisdictionDirs } = readInputFiles(args);
  let engine = getProcessor(style, library, jurisdictionDirs);
  return {
    engine: engine,
    results: rawProcessUnits(engine, units)
  };
}

function rawProcessUnits(engine, units) {
  let results = [];
  units.forEach((unit) => {
    if (unit.tests) {
      unit.tests.forEach(test => {
        if (test.single && test.expect) {
          let res = produceSingle(engine, test.single);
          results.push({ ...test, result: res, passed: res === test.expect });
        }
        if (test.sequence && test.expect) {
          let res = produceSequence(engine, test.sequence);
          results.push({ ...test, result: res, passed: sequenceMatches(test.expect, res) });
        }
      })
    }
  });
  return results;
}

function sequenceMatches(expected, actual) {
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false;
  }
  return true;
}

module.exports = {
  cslTestResults
}
