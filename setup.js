const { ensureCachedRepos, getDefaultCacheDir } = require('./src/lib');

module.exports = async (globalConfig) => {
  await ensureCachedRepos(getDefaultCacheDir());
}
