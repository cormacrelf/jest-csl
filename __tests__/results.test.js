const { cslTestResults } = require('../index');
let config = require('./integration.test');

describe("results object", () => {
  let { library, citeIds, units } = cslTestResults(config);
  it("includes an item used in the test", () => {
    expect(citeIds).toContain('ITEM-1');
    expect(library).not.toBeNull();
    expect(library['ITEM-1']).not.toBeNull();
    expect(library['ITEM-1'].type).toBe('book');
  });
  it("has a passing test", () => {
    let u = units[0]
    expect(u && u.tests).not.toBeNull();
    let t = u.tests[0];
    expect(t).not.toBeNull();
    expect(t.passed).toBe(true);
    expect(t.result).toMatchObject(t.expect);
  });

  it("includes meta and doc on a unit", () => {
    let u = units[0];
    expect(u.meta).toMatchObject({included: true});
    expect(u.doc).toBe("some docs");
  })
});

