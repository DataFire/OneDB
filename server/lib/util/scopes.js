const SCOPE_ORDER = ['read', 'create', 'write', 'append', 'destroy', 'modify_acl'];

module.exports = function(scopeString) {
  const permissions = {};
  scopeString.split(' ').forEach(perm => {
    let [namespace, access] = perm.split(':');
    permissions[namespace] = permissions[namespace] || [];
    if (!permissions[namespace].includes(access)) {
      permissions[namespace].push(access);
    }
  });
  for (let namespace in permissions) {
    permissions[namespace].sort((a1, a2) => {
      return SCOPE_ORDER.indexOf(a1) < SCOPE_ORDER.indexOf(a2) ? -1 : 1;
    })
  }
  return permissions;
}
