const DEFAULT_SECONDARY_LOCATION = 'http://localhost:4000';

module.exports = function() {
  var self = this;
  if (typeof window === 'undefined') {
    throw new Error("Tried to get form in non-browser context");
  }

  function getInput(idx) {
    var inputID = 'FreeDBHost';
    if (idx >= 0) inputID += idx;
    return document.getElementById(inputID).value;
  }

  function getHost(idx) {
    return idx === -1 ? self.hosts.primary : self.hosts.secondary[idx];
  }

  window._freeDBHelpers = {
    addHost: function() {
      let newHost = {location: DEFAULT_SECONDARY_LOCATION};
      self.hosts.secondary.push(newHost);
      self.getUser(newHost);
    },
    removeHost: function(idx) {
      self.hosts.secondary = self.hosts.secondary.filter((h, i) => i !== idx);
      self.getUser(null);
    },
    updateHost: function(idx) {
      var host = getHost(idx);
      host.location = getInput(idx);
    },
    login: function(idx) {
      window._freeDBHelpers.updateHost(idx);
      var host = getHost(idx);
      self.authorize(host);
    },
    logout: function(idx) {
      if (idx === -1) {
        let host = getHost(idx);
        host.username = host.password = host.token = null;
        self.getUser(host);
      } else {
        window._freeDBHelpers.removeHost(idx);
      }
    }
  }

  return `
<h4>Primary</h4>
<p>This is where your data will be stored.</p>
${hostTemplate(this.hosts.primary, -1)}
<hr>
<h4>Secondary</h4>
<p>
  You can optionally broadcast changes to other hosts. They won't store your data - they'll
  just get a pointer to your primary host.
</p>
${this.hosts.secondary.map(hostTemplate).join('\n')}
<a class="btn btn-secondary" onclick="_freeDBHelpers.addHost()">Add a secondary host</a>
`
}

function hostTemplate(host, idx) {
  return `
<form onsubmit="_freeDBHelpers.login(${idx}); return false">
  <div class="form-group">
    <div class="input-group">
      ${!host.user ? '' : `
        <div class="input-group-prepend">
          <span class="input-group-text">${host.user._id}@</span>
        </div>
      `}
      <input
          class="form-control"
          value="${host.location}"
          id="FreeDBHost${idx >= 0 ? idx : ''}"
          onchange="_freeDBHelpers.updateHost(${idx})">
      ${host.user ? `
        <div class="input-group-append">
          <button class="btn btn-outline-secondary" type="button" onclick="_freeDBHelpers.logout(${idx})">
            Log Out
          </button>
        </div>
      ` : `
        <div class="input-group-append">
          <button class="btn btn-outline-secondary" type="submit">
            Log In
          </button>
        </div>
      `}
    </div>
  </div>
</form>
`
}
