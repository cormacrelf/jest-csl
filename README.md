# `jest-csl`

This is a library to make testing [Citation Style Language][csl] definitions 
easier using [`Jest`][jest]. It includes:

* A testing-specific abstraction over the unwieldy [`citeproc-js`][citeproc-js]
* A mechanism to fetch and cache [locales][locales] and the Juris-M 
  [style-modules][style-modules] (i.e. jurisdiction-specific CSL-M modules), 
  and let the processor access them.
* A schema for writing CSL specs in YAML
* A simple function to execute one Jest test for each test in a spec, for a 
  particular CSL-JSON reference library, for a particular style
* A function to to collect results for further processing (like turning it into 
  HTML).

[csl]: https://citationstyles.org/
[jest]: https://jestjs.io/
[citeproc-js]: https://github.com/Juris-M/citeproc-js
[locales]: https://github.com/citation-style-language/locales
[style-modules]: https://github.com/Juris-M/style-modules

## How to test your CSL

### Prerequisites

* You should be familiar with using a shell. You should be able to open up a 
  terminal, and use `ls`, `cd`, `mkdir` and friends.
* You need to have `Node.js` installed. Run `node -v` to check it's version 10 
  or later.
* You should install `yarn` with `npm install -g yarn`, or mentally replace 
  `yarn` in the rest of this document with `npm`.

### Set up your project

This step is fairly flexible, but the following will work and is a good place 
to start.

```
my-style-repo
├── src
│   ├── style.csl
│   └── juris-au-style.csl (jurisdiction override, if you are using CSL-M)
├── test
│   ├── corpus.json
│   ├── style.test.js
│   └── style.spec.yaml
├── package.json
├── .gitignore
└── jest.config.js
```

Name your items according to whatever your style is called, like 
`chicago-author-date.csl` instead of `style.csl`.

#### `package.json`

Add a package.json with the following contents:

```json
{
  "scripts": {
    "test": "jest --watchAll --noStackTrace"
  }
}
```

**Then, run `yarn add -D jest jest-csl`.** You will get the latest version of 
`jest` and this library (`jest-csl`).

#### `test/corpus.json`

This file should not be built by hand, it is too tedious. Instead:

1. Install [Zotero Better Bibtex][zbb] in your choice of Zotero or Juris-M.
2. Create a library for testing your style, optionally add some items to it
3. Export your library with `Right-Click > Export Library ...`; select `Better 
   CSL JSON` and tick the `Keep updated` box.
4. When selecting the destination, choose 
   `/path/to/your-style-repo/test/corpus.json`.

[zbb]: https://retorque.re/zotero-better-bibtex/

#### `test/style.spec.yaml`

This is where you write your tests. See below.

#### `test/style.test.js`: a test configuration

Insert the following contents, modifying `STYLE` and optionally un-commenting 
or deleting `jurisdictionDirs` as required for your own style:

```javascript
module.exports = {
  csl: "./src/STYLE.csl",
  // use jurisdictionDirs if you are using CSL-M and want to include overrides
  // jurisdictionDirs: ["./src"],
  libraries: ["./test/corpus.json"],
  suites: ["./test/STYLE.spec.yaml"]
};

if (typeof jest !== 'undefined') {
  const { jestCSL } = require('jest-csl');
  jestCSL(module.exports);
}
```

#### `jest.config.js`

This file lets `jest-csl` check that the locales are all cached before running.

```javascript
module.exports = {
  globalSetup: "jest-csl/setup"
};
```

It won't update the cache. That would be too slow to do on *every* test run. 
See 'Updating the cache' below.

#### `.gitignore`

You're probably going to want to put all of this in Git at some point, so add 
these contents:

```
node_modules
```

### Writing tests

> Note: This test suite was developed for a footnote-based style. If you're 
> building a different kind of style (i.e. trying to test bibliography output), 
> we might need to add a new kind of test, so please file an issue.

Specs are written in YAML. If you haven't written YAML before, read [this 
primer][primer].

[primer]: https://getopentest.org/reference/yaml-primer.html

The YAML spec files are structured somewhat like a Jest test suite. Here's an 
example:

```yaml
- describe: "Name of a feature of this CSL to test (often a kind of document)"
  tests:

    - it: "should render a basic book citation"
      single: { id: "doe2001" }
      # you can use > to join multiple lines with spaces if a line gets long
      expect: "Doe, <i>Miscellaneous Writings</i>, 2001."

    - it: "should include both volume and issue in a journal article"
      single: { id: "doe2003" }
      # you can use > to join multiple lines with spaces if a line gets long
      # <i></i> is italics, for other formats just run the test first
      expect: >
        John Doe, 'A Journal Article Written in My Diary' (2003) 89(3) 
        <i>John's Diary</i> 124.
```

for more complex combined citations, use 'sequence' to test the
in-texts/footnotes generated for a sequence of clusters of cites.

```yaml
- describe: "..."
  tests:
    ...
- describe: "Subsequent references"
  tests:
    - it: "should render plain ibids for the same locator"
      sequence:
        - cluster:
          - { id: "doe2001", locator: "5", label: "page" }
          - { id: "doe2001", locator: "5", label: "page", prefix: "see also", suffix: "etc" }
        - cluster:
          - { id: "doe2001", locator: "5", label: "page" }
      expect:
        - Doe, <i>Miscellaneous Writings</i>, 2001, p. 5; see also <i>ibid</i> etc.
        - <i>Ibid</i>.
```

### Combining test suites

Sometimes you will have sets of tests that you want to pass for two different 
styles, and then extended suites that only apply to one style. This might 
encompass two variations on one style, or just the plain CSL vs CSL-M versions 
of your style. It would make sense to have more than one test configuration 
(`.test.js` file) to exercise more than one combination.

You can pass multiple suites in your test configuration file. They will be 
merged according to the order; later styles with the same `describe > it` 
combinations will override previous ones.

```yaml
# core.spec.yaml
describe: "Unit"
tests:
  - it: "should a"
    ...
  - it: "should b"
    ...

# extended.spec.yaml
describe: "Unit"
tests:
  - it: "should b"
    single: "override"
    expect: "override"
  - it: "should c"
    single: "new"
    expect: "new"
```

Setting

```javascript
{
  // ...
  suites: ["./test/core.spec.yaml", "./test/extended.spec.yaml"]
}
```

Results in all three tests being run, with "should a" preserved, "should b" 
overridden and "should c" added.

### Further splitting of test suites

For convenience, you can split a large test suite into multiple files, and 
combine them all with a glob. Use a level of directories or a naming scheme to 
separate groups that should be strictly before or after one another.

```javascript
{
  // ...
  suites: ["./test/core/*.yaml", "./test/extended/*.yaml"]
}
```

The same works for `jurisdictionDirs` and `libraries`.

### Running your tests

    yarn test

Follow the onscreen instructions to interact with the Jest environment (or 
quit).

### Updating the cache

    yarn jest-csl update

This will attempt to update your cached locales and style-modules.
