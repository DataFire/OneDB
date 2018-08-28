const DEFAULT_SECONDARY_LOCATION = 'http://localhost:4000';

module.exports = function() {
  var self = this;
  if (typeof window === 'undefined') {
    throw new Error("Tried to get form in non-browser context");
  }

  function getInput(type, idx) {
    var inputID = '_FreeDBHostInput_' + type;
    if (type === 'secondary') inputID += idx;
    return document.getElementById(inputID).value;
  }

  function getHost(type, idx) {
    let host = self.hosts[type];
    if (type === 'secondary') host = host[idx];
    return host;
  }

  window._freeDBHelpers = window._freeDBHelpers || {
    showAdvanced: false,
    addHost: function() {
      var newHost = {location: DEFAULT_SECONDARY_LOCATION};
      self.hosts.secondary.push(newHost);
      self.getUser(newHost);
    },
    removeHost: function(idx) {
      self.hosts.secondary = self.hosts.secondary.filter((h, i) => i !== idx);
      self.getUser(null);
    },
    updateHost: function(type, idx) {
      var host = getHost(type, idx);
      host.location = getInput(type, idx);
    },
    login: function(type, idx) {
      window._freeDBHelpers.updateHost(type, idx);
      var host = getHost(type, idx);
      self.authorize(host);
    },
    logout: function(type, idx) {
      var host = getHost(type, idx);
      host.username = host.password = host.token = null;
      self.getUser(host);
    },
    toggleAdvancedOptions: function() {
      var el = document.getElementById('_FreeDBAdvancedOptions');
      _freeDBHelpers.showAdvanced = !_freeDBHelpers.showAdvanced;
      if (_freeDBHelpers.showAdvanced) {
        el.setAttribute('style', '');
      } else {
        el.setAttribute('style', 'display: none');
      }
    }
  }

  return `
<h4>Data Host</h4>
<p>This is where your data will be stored.</p>
${hostTemplate(this.hosts.primary, 'primary')}
<a href="javascript:void(0)" onclick="_freeDBHelpers.toggleAdvancedOptions()">Advanced options</a>
<div id="_FreeDBAdvancedOptions" style="${ _freeDBHelpers.showAdvanced ? '' : 'display: none'}">
  <hr>
  <h4>Broadcast</h4>
  <p>
    Changes to your data will be broadcast to these hosts.
    They won't store your data - they'll
    just get a link to the data on your primary host.
  </p>
  <p>
    Note: removing hosts may prevent you from continuing interactions with other users.
    ${this.hosts.secondary.map((host, idx) => hostTemplate(host, 'secondary', idx)).join('\n')}
  </p>
  <p>
    <button class="btn btn-secondary" onclick="_freeDBHelpers.addHost()">Add a broadcast host</button>
  </p>
  <h4>Core</h4>
  <p>
    The Core host contains data schemas and other information.
    Only change this if you know what you're doing.
    ${hostTemplate(this.hosts.core, 'core')}
  </p>
</div>
`
}

function hostTemplate(host, type, idx) {
  return `
<form onsubmit="_freeDBHelpers.login('${type}', ${idx}); return false">
  <div class="form-group">
    <div class="input-group">
      ${type !== 'secondary' ? '' : `
        <div class="input-group-prepend">
          <button class="btn btn-danger" type="button" onclick="_freeDBHelpers.removeHost(${idx})">
            &times;
          </button>
        </div>
      `}
      ${!host.user ? '' : `
        <div class="input-group-prepend">
          <span class="input-group-text">${host.user.$.id}@</span>
        </div>
      `}
      <input
          class="form-control"
          value="${host.location}"
          id="_FreeDBHostInput_${type}${type === 'secondary' ? idx : ''}"
          onchange="_freeDBHelpers.updateHost('${type}', ${idx})">
      ${host.user ? `
        <div class="input-group-append">
          <button class="btn btn-outline-secondary" type="button"
                  onclick="_freeDBHelpers.logout('${type}', ${idx})">
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
