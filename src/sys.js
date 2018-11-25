const log = require('loglevel');
const { getCacheLoc } = require('./lib');
const { makeGetAbbreviation } = require('./getAbbreviation');
const fs = require('fs');
const path = require('path');

const makeSys = (citations, jurisdictionDirs, myAbbreviations, gotAbbreviationCache) => ({
  retrieveLocale: function (lang) {
    let ctx = log.getLogger('sys')
    ctx.debug('retrieving locale: %s', lang);
    let p = path.join(getCacheLoc('locales'), 'locales-'+lang+'.xml');
    let locale = fs.readFileSync(p, 'utf8')
    return locale;
  },

  retrieveItem(id){
    return citations[id];
  },

  getAbbreviation: makeGetAbbreviation(myAbbreviations, gotAbbreviationCache),

  retrieveStyleModule(jurisdiction, preference) {
    let cp = log.getLogger('sys')
    let jp = jurisdiction + (preference ? '-' + preference : '')
    cp.debug(`retrieving style module: ${jp}`);
    let ctx = log.getLogger(`sys > retrieve ${jp}`)

    jurisdiction = jurisdiction.replace(/\:/g, "+");
    var id = preference
      ? "juris-" + jurisdiction + "-" + preference + ".csl"
      : "juris-" + jurisdiction + ".csl";
    let tryFile = (x) => {
      ctx.trace(`searching ${x}`)
      let t = fs.readFileSync(x, 'utf8')
      if (t) ctx.trace(`found ${x}`)
      return t;
    }
    jurisdictionDirs.push(getCacheLoc('style-modules'));
    let ord = jurisdictionDirs
      .map(d => () => tryFile(path.join(d, id)));
    let ret = false;
    for (var i = 0; i < ord.length; i++) {
      try {
        ret = ord[i]();
        if (ret) {
          return ret;
        };
      } catch (e) {
        continue;
      }
    }
    return ret;
  }
});

module.exports = {
  makeSys,
}
