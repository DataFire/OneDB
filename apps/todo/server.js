let express = require('express');
let app = express();

const DIR = __dirname + '/dist/browser';
const INDEX = require('fs').readFileSync(DIR + '/index.html');

app.use(express.static(__dirname + '/dist/browser'));
app.get('*', (req, res) => {
  res.end(INDEX);
})

app.listen(process.env.PORT || 4010);
