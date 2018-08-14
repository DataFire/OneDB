const express = require('express');
const validate = require('../validate');
const errorGuard = require('../error-guard');
const fail = require('../fail');

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
  '/core/authorization_token',
];

const requireLogin = errorGuard(async function(req, res, next) {
  if (req.user) return next();
  else return fail("You need to log in to do that", 401);
});

const getData = function(item) {
  const data = item.data;
  if (typeof data === 'object' && !Array.isArray(data)) {
    data._id = item.id;
  }
  return data;
}

const router = module.exports = new express.Router();

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
  res.json(getData(req.item));
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
  const err = validate.validators.listQuery(req.query);
  if (err) return fail(err, 400);
  const {query, sort, pageSize, skip} = await req.db.buildListQuery(req.params.namespace, req.params.typeID, req.query);
  const items = await req.db.list(req.params.namespace, req.params.typeID, query, sort, pageSize, skip);
  const page = {
    items: items.map(getData),
    total: await req.db.count(req.params.namespace, req.params.typeID, query),
    pageSize: req.query.pageSize,
    skip: req.query.skip,
  }
  page.hasNext = page.items.length + page.skip < page.total;
  res.json(page);
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
  await req.db.modifyACL(req.params.namespace, req.params.typeID, req.params.itemID, req.body);
  res.json("Success");
}));

/**
 * Destroy
 */
router.delete(ITEM_PATH, errorGuard(async (req, res) => {
  await req.db.destroy(req.params.namespace, req.params.typeID, req.params.itemID);
  res.json("Succes");
}));

