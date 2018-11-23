// Based on https://github.com/citation-style-language/test-suite/blob/master/processor-tests/humans/integration_SimpleIbid.txt

module.exports = {
  csl: "./__tests__/integration.csl",
  libraries: ["./__tests__/integration.json"],
  suites: ["./__tests__/integration.yaml"],
  output: "./results-ibid.json"
}

