const express = require('express');
const bodyParser = require('body-parser');
const validate = require('./validate');
const config = require('./config');
const errorGuard = require('./error-guard');
const fail = require('./fail');

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

const requireLogin = errorGuard(async function(req, res, next) {
  if (req.user) return next();
  else return fail("You need to log in to do that", 401);
});

module.exports = function(database) {
  const router = module.exports = new express.Router();
  router.use(bodyParser.json({strict: false, limit: config.maxBytesPerItem}));

  router.use(TYPE_PATH, validate.namespace, validate.typeID);
  router.use(ITEM_PATH, validate.itemID);

  router.use(RESTRICTED_PATHS, errorGuard((req, res) => {
    fail("That operation is restricted", 401);
  }));
  router.use(GET_ONLY_PATHS, errorGuard((req, res, next) => {
    if (req.method === 'GET') return next();
    fail("That operation is restricted", 401);
  }));

  /**
   *  Retrieve prep
   */
  router.get([ITEM_PATH, ACL_PATH, INFO_PATH], errorGuard(async (req, res, next) => {
    req.item = await req.db.get(req.params.namespace, req.params.typeID, req.params.itemID);
    if (!req.item) {
      res.status(404).json({message: `Item ${req.params.namespace}/${req.params.typeID}/${req.params.itemID} not found`});
    } else {
      next();
    }
  }));

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
  router.get(TYPE_PATH, errorGuard(async (req, res) => {
    // TODO: validate search params
    let items = req.db.getAll(req.params.namespace, req.params.typeID, req.query);
    items = items.map(i => i.data);
    res.json(items);
  }));

  router.use(requireLogin);

  /**
   *  Create
   */
  router.post([TYPE_PATH, ITEM_PATH], errorGuard(async (req, res) => {
    let item = await req.db.create(req.params.namespace, req.params.typeID, req.body, req.params.itemID);
    res.json(item.id);
  }));

  /**
   * Update
   */
  router.put(ITEM_PATH, errorGuard(async (req, res) => {
    await req.db.update(req.params.namespace, req.params.typeID, req.params.itemID, req.body)
    res.json("Success");
  }));

  /**
   * Update ACL
   */
  router.put(ACL_PATH, errorGuard(async (req, res) => {
    await req.db.setACL(req.params.namespace, req.params.typeID, req.params.itemID, req.body);
    res.json("Success");
  }));

  /**
   * Destroy
   */
  router.delete(ITEM_PATH, errorGuard(async (req, res) => {
    await req.db.destroy(req.params.namespace, req.params.typeID, req.params.itemID);
    res.json("Succes");
  }));

  return router;
}
