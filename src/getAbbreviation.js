const CSL = require("citeproc");

module.exports = {
  normalizeKey,
  lookupKey,
  makeGetAbbreviation,
}

function normalizeKey(key) {
  // Strip periods, normalize spacing, and convert to lowercase
  return key.toString().
    replace(/(?:\b|^)(?:and|et|y|und|l[ae]|the|[ld]')(?:\b|$)|[\x21-\x2C.\/\x3A-\x40\x5B-\x60\\\x7B-\x7E]/ig, "").
    replace(/\s+/g, " ").trim();
}

function lookupKey(key) {
  return key.toLowerCase().replace(/\s*\./g, "." );
}

// see manual/citeproc-doc.rst
// state.opt.styleID, state.transform.abbrevs, jurisdiction, category, orig, itemType, true
// category: 'title', 'collection-title', 'container-title', 'place', 'institution-part', 'institution-entire', 'number'
// noHints: lets getAbbreviation 'guess' for titles, short-titles of non-legal items
// as usual, you gotta copy directly from the juris-m/zotero codebase for this function to make any sense
//
// TODO: copy this instead
// https://github.com/Juris-M/abbrevs-filter/blob/196dc7f794b150c743f2fe6693cb28644e2c830d/chrome/content/xpcom/csl-get-abbreviation.js

function makeGetAbbreviation(myAbbreviations, gotAbbreviationCache) {
  return function getAbbreviation(listname, obj, jurisdiction, category, key) {
    let abbreviations = myAbbreviations();
    // category === 'hereinafter' && console.log(listname, abbreviations, jurisdiction, category, key);
    gotAbbreviationCache(obj);
    abbreviationCategories = {};
    for(let juris in abbreviations) {
      for(let cat in abbreviations[juris]) {
        abbreviationCategories[cat] = true;
      }
    }

    // Short circuit if we know we don't handle this kind of abbreviation
    if(!abbreviationCategories[category] && !abbreviationCategories[category+"-word"]) {
      return;
    };

    let normalizedKey = normalizeKey(key),
      lcNormalizedKey = lookupKey(normalizedKey),
      abbreviation;
    if(!normalizedKey) return;

    let jurisdictions = ["default"];
    if(jurisdiction !== "default" && abbreviations[jurisdiction]) {
      jurisdictions.unshift(jurisdiction);
    }

    // Look for full abbreviation
    let jur, cat;
    for(let i=0; i<jurisdictions.length && !abbreviation; i++) {
      if((jur = abbreviations[jurisdictions[i]]) && (cat = jur[category])) {
        abbreviation = cat[lcNormalizedKey];
      }
    }

    if (!abbreviation && category === 'hereinafter') {
      return;
    }
    // from this point on, we're always going to return _an_ abbreviation

    if(!abbreviation) {
      // Abbreviate words individually
      let words = normalizedKey.split(/([ \-])/);

      if(words.length > 1) {
        let lcWords = [];
        for(let j=0; j<words.length; j+=2) {
          lcWords[j] = lookupKey(words[j]);
        }
        for(let j=0; j<words.length; j+=2) {
          let word = words[j],
            lcWord = lcWords[j],
            newWord = undefined,
            exactMatch = false;

          for(let i=0; i<jurisdictions.length && newWord === undefined; i++) {
            if(!(jur = abbreviations[jurisdictions[i]])) continue;
            if(!(cat = jur[category+"-word"])) continue;

            if(cat.hasOwnProperty(lcWord)) {
              // Complete match
              newWord = cat[lcWord];
              exactMatch = true;
            } else if(lcWord.charAt(lcWord.length-1) == 's' && cat.hasOwnProperty(lcWord.substr(0, lcWord.length-1))) {
              // Try dropping 's'
              newWord = cat[lcWord.substr(0, lcWord.length-1)];
              exactMatch = true;
            } else {
              if(j < words.length-2) {
                // Two-word match
                newWord = cat[lcWord+words[j+1]+lcWords[j+2]];
                if(newWord !== undefined) {
                  words.splice(j+1, 2);
                  lcWords.splice(j+1, 2);
                  exactMatch = true;
                }
              }

              if(newWord === undefined) {
                // Partial match
                for(let k=lcWord.length; k>0 && newWord === undefined; k--) {
                  newWord = cat[lcWord.substr(0, k)+"-"];
                }
              }
            }
          }

          // Don't substitute with a longer word
          if(newWord && !exactMatch && word.length - newWord.length < 1) {
            newWord = word;
          }

          // Fall back to full word
          if(newWord === undefined) newWord = word;

          // Don't discard last word (e.g. Climate of the Past => Clim. Past)
          if(!newWord && j == words.length-1) newWord = word;

          words[j] = newWord.substr(0, 1).toUpperCase() + newWord.substr(1);
        }
        abbreviation = words.join("").replace(/\s+/g, " ").trim();
      } else {
        abbreviation = key;
      }
    }

    if(!abbreviation) abbreviation = key; //this should never happen, but just in case

    // console.log("Abbreviated "+key+" as "+abbreviation);

    // Add to jurisdiction object
    if(!obj[jurisdiction]) {
      obj[jurisdiction] = new CSL.AbbreviationSegments();
    }
    obj[jurisdiction][category][key] = abbreviation;
  }

}
