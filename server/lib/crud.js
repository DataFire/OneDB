const express = require('express');
const router = module.exports = new express.Router();
const validate = require('./validate');
const config = require('./config');

router.use(bodyParser.json(config.maxDataSize));

router.use('/:namespace', validate.namespace);

router.use('/:typeID', validate.typeID, async (req, res, next) => {
  req.type = await database.get('type', req.params.type);
  if (!req.type) {
    return validate.sendError(res, `Type ${req.params.typeID} not found`);
  }
  next();
});

router.post('/:typeID', validate.type);
router.patch('/:typeID', validate.type);
router.put('/:typeID', validate.type);
