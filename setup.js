const { ensureCachedRepos } = require('./src/lib');

module.exports = async (globalConfig) => {
  await ensureCachedRepos();
}
