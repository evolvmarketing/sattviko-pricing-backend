const { join } = require('path');

// Keep Chrome inside the project folder so Render ships it from the build step to the running service.
// (The default ~/.cache/puppeteer is NOT carried over on Render, which caused "Could not find Chrome".)
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
