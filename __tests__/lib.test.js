const { getProcessor, getLibrary, jestRunner, mergeUnits, normalizeItalics, insertMissingPageLabels } = require('../src/lib');

let unit = (name, tests) => ({ describe: name, tests: tests });
let testSingle   = (name, single, expect) => ({ it: name, single, expect });
let testSequence = (name, tests) => ({ it: name, tests: tests });

describe('normalizeItalics', () => {
  it('should work', () => {
    expect(normalizeItalics("</i><i>")).toBe("");
    expect(normalizeItalics("</i> <i>")).toBe(" ");
    expect(normalizeItalics("<i>yeah</i> <i>nah</i>")).toBe("<i>yeah nah</i>");
    let unchanged = "<i>yeah</i>boi<i>nah</i>";
    expect(normalizeItalics(unchanged)).toBe(unchanged);
  })
});

describe('insertMissingPageLabels', () => {
  it('should work', () => {
    expect(insertMissingPageLabels({ single: {locator: "5", label: "section"} }))
      .toMatchObject({ single: {locator: "5", label: "section"} })
    expect(insertMissingPageLabels({ single: {locator: "5"} }))
      .toMatchObject({ single: {locator: "5", label: "page"} })
    expect(insertMissingPageLabels({ sequence: [{cluster: [{locator: "5", label: "section"}]}] }))
      .toMatchObject({ sequence: [{cluster: [{locator: "5", label: "page", label: "section"}]}] });
    expect(insertMissingPageLabels({ sequence: [{cluster: [{locator: "5"}]}] }))
      .toMatchObject({ sequence: [{cluster: [{locator: "5", label: "page"}]}] });
  })
})

describe('mergeUnits', () => {
  it('should merge(a, a) == a', () => {
    let units = [];
    expect(mergeUnits(units, units)).toMatchObject(units);
    units = [unit('a', [testSingle('a.a', '', '')])];
    expect(mergeUnits(units, units)).toMatchObject(units);
  });
  it('should include the union of described units', () => {
    let a = [unit('a', [])];
    let b = [unit('b', [])];
    let m = mergeUnits(a, b);
    let ks = [...m.map(u => u.describe)];
    expect(ks).toContain('a');
    expect(ks).toContain('b');
  });
  it('should merge units with the same describe', () => {
    let a = [unit('same', [])];
    let b = [unit('same', [])];
    let m = mergeUnits(a, b);
    let ks = [...m.map(u => u.describe)];
    expect(ks).toMatchObject(['same']);
  });
  it('should merge individual test lists', () => {
    let a = [unit('same', [testSingle('ONE', {id:""}, '')])];
    let b = [unit('same', [testSingle('TWO', {id:"two"}, 'two')])];
    let m = mergeUnits(a, b);
    let same = m[0];
    expect(same.tests).toHaveLength(2);
    let one = m[0].tests[0];
    let two = m[0].tests[1];
    expect(one.it).toBe("ONE");
    expect(two.it).toBe("TWO");
  });
  it('should overwrite the same test ID with B', () => {
    let a = [unit('same', [testSingle('SAME', {id:""}, '')])];
    let b = [unit('same', [testSingle('SAME', {id:"two"}, 'two')])];
    let m = mergeUnits(a, b);
    let same = m[0];
    expect(same.tests).toHaveLength(1);
    let one = m[0].tests[0];
    expect(one.it).toBe("SAME");
    expect(one.expect).toBe("two");
  });
})

