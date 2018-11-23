const { jestCSL, TestEngine, readTestUnits } = require('../index');
const config = require('./integration.test');

jestCSL(config);

describe("programmatic", () => {
  it("should fail a test", () => {
    const { jestTestCase } = require('../src/jest');
    const units = readTestUnits(config.suites);
    const engine = new TestEngine(config);
    const failingTest = {
      it: "should fail",
      single: { id: "ITEM-1" },
      expect: "(DoeNOT)"
    }
    expect(() => jestTestCase(engine, failingTest)).toThrowErrorMatchingSnapshot();
  });
})
