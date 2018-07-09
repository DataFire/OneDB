module.exports = function(database) {
  return async (req, res, next) => {
    let auth = req.get('authorization');
    if (!auth) {
      return res.status(400).json({message: "Invalid authorization header"});
    }
    let parts = auth.split(' ');
    if (parts[0] === 'Basic') {
      let creds = (new Buffer(parts[1], 'base64')).toString().split(':');
      if (creds.length !== 2) return res.status(400).send("Invalid authorization header");
      email = creds[0];
      password = creds[1];
      let user = await database.createUser(email, password);
      res.json(user.id);
    } else {
      res.status(400).send("Invalid authorization header");
    }
  }
}
