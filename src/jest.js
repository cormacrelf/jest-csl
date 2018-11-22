const { getProcessor, produceSingle, produceSequence, readInputFiles, normalizeItalics } = require('./lib');

// these functions are to be run from within the jest context
// (ie with describe() and friends globally defined already.)

// args: {
//   csl: string path to a CSL file,
//   libraries: array of string paths to exported CSL-JSON libraries,
//   suites: array of string paths to YAML test suites
// }
function jestCSL(args) {
  if (typeof jest === 'undefined') {
    return;
  }
  let { style, library, units, jurisdictionDirs } = readInputFiles(args);
  let engine = getProcessor(style, library, jurisdictionDirs);

  units.forEach(unit => {
    describe(unit.describe, () => {
      if (unit.tests) {
        unit.tests.forEach(test => {
          let run = () => {
            jestTestCase(engine, test);
          }
          // mode: skip | only (not doc)
          if (test.mode && it[test.mode]) {
            it[test.mode](test.it, run);
          } else {
            if (test.expect) {
              it(test.it, run)
            } else {
              it.skip(test.it, run); // stub
            }
          }
        })
      }
    })
  });
}

function jestTestCase(engine, test) {
  if (test.single && test.expect) {
    let out = produceSingle(engine, test.single, test.format);
    expect(normalizeItalics(out)).toBe(normalizeItalics(test.expect));
  } else if (test.sequence && test.expect) {
    let out = produceSequence(engine, test.sequence, test.format);
    expect(out.map(normalizeItalics)).toMatchObject(test.expect.map(normalizeItalics));
  }
}

module.exports = {
  jestCSL
}
