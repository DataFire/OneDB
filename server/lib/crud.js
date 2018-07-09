const express = require('express');
const bodyParser = require('body-parser');
const validate = require('./validate');
const config = require('./config');

const NAMESPACE_PATH = '/:namespace';
const TYPE_PATH = NAMESPACE_PATH + '/:typeID';
const ITEM_PATH = TYPE_PATH + '/:itemID';
const ACL_PATH = ITEM_PATH + '/acl';
const INFO_PATH = ITEM_PATH + '/info';

const GET_ONLY_PATHS = [
  '/core/user',
];
const RESTRICTED_PATHS = [
  '/core/user_private',
];

const requireLogin = function(req, res, next) {
  if (req.user) return next();
  res.status(401).json({message: "You need to log in to do that"});
}

module.exports = function(database) {
  const router = module.exports = new express.Router();
  router.use(bodyParser.json(config.maxDataSize));

  router.use(TYPE_PATH, validate.namespace, validate.typeID);
  router.use(ITEM_PATH, validate.itemID);

  router.use(RESTRICTED_PATHS, (req, res) => {
    res.status(401).send("This operation is restricted");
  });
  router.use(GET_ONLY_PATHS, (req, res, next) => {
    if (req.method === 'GET') return next();
    res.status(401).send("This operation is restricted");
  })

  /**
   *  Retrieve prep
   */
  router.get([ITEM_PATH, ACL_PATH, INFO_PATH], async (req, res, next) => {
    req.item = await req.db.get(req.params.namespace, req.params.typeID, req.params.itemID);
    if (!req.item) {
      res.status(404).json({message: `Item ${req.params.namespace}/${req.params.typeID}/${req.params.itemID} not found`});
    } else {
      next();
    }
  });

  /**
   * Retrieve Data
   */
  router.get(ITEM_PATH, (req, res) => {
    res.json(req.item.data);
  });

  /**
   * Retrieve ACL
   */
  router.get(ACL_PATH, (req, res) => {
    res.json(req.item.acl);
  });

  /**
   * Retrieve Info
   */
  router.get(INFO_PATH, (req, res) => {
    res.json(req.item.info);
  });

  /**
   *  List
   */
  router.get(TYPE_PATH, async (req, res) => {
    // TODO: validate search params
    let items = req.db.getAll(req.params.namespace, req.params.typeID, req.query);
    items = items.map(i => i.data);
    res.json(items);
  });

  router.use(requireLogin);

  /**
   *  Create
   */
  router.post([TYPE_PATH, ITEM_PATH], async (req, res) => {
    await req.db.create(req.params.namespace, req.params.typeID, req.body, req.params.itemID);
    res.json("Success");
  });

  /**
   * Update
   */
  router.put(ITEM_PATH, async (req, res) => {
    await req.db.update(req.params.namespace, req.params.typeID, req.params.itemID, req.body)
    res.json("Success");
  });

  /**
   * Update ACL
   */
  router.put(ACL_PATH, async (req, res) => {
    await req.db.setACL(req.params.namespace, req.params.typeID, req.params.itemID, req.body);
    res.json("Success");
  });

  /**
   * Destroy
   */
  router.delete(ITEM_PATH, async (req, res) => {
    await req.db.destroy(req.params.namespace, req.params.typeID, req.params.itemID);
    res.json("Succes");
  });

  router.use((err, req, res, next) => {
    if (err.statusCode) res.status(err.statusCode);
    else res.status(500);
    console.log(err);
    res.json({message: err.message || "Unknown error"});
  });

  return router;
}
