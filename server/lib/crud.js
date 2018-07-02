const express = require('express');
const router = module.exports = new express.Router();
const validate = require('./validate');
const config = require('./config');
const Database = require('./database');
const validate = require('./validate');
const database = new Database(config.mongodb);

router.use(bodyParser.json(config.maxDataSize));

router.use('/:namespace', validate.namespace);

router.post('/:namespace', async (req, res, next) => {
  let result = await database.create('namespace', req.params.namespace);
  res.json("Success");
});

router.use('/:namespace/:typeID', validate.typeID, async (req, res, next) => {
  req.type = await database.get('type', req.params.type);
  if (!req.type) {
    return validate.sendError(res, `Type ${req.params.typeID} not found`);
  }
  next();
});

router.post('/:namespace/:typeID', validate.type);
router.patch('/:namespace/:typeID', validate.type);
router.put('/:namespace/:typeID', validate.type);
