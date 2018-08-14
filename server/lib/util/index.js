const fs = require('fs');
fs.readdirSync(__dirname).forEach(file => {
  if (file === 'index.js') return;
  module.exports[file.replace('.js', '')] = require('./' + file);
})
