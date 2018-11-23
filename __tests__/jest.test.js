const { jestCSL, TestEngine, readTestUnits } = require('../index');
const config = require('./integration.test');

jestCSL(config);

const { jestTestCase } = require('../src/jest');
const engine = new TestEngine(config);
const failing = readTestUnits(['./__tests__/failing.yaml']);

describe("programmatic test unit", () => {
  it("should fail a test", () => {
    const failingTest = failing[0].tests.find(t => t.it === 'should fail a single test');
    expect(() => jestTestCase(engine, failingTest)).toThrowErrorMatchingSnapshot();
  });
  it("should fail a sequence", () => {
    const failingTest = failing[0].tests.find(t => t.it === 'should fail a sequence');
    expect(() => jestTestCase(engine, failingTest)).toThrowErrorMatchingSnapshot();
  });
})
