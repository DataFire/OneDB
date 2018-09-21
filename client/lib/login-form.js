const DEFAULT_SECONDARY_LOCATION = 'http://localhost:4000';

function isMultiType(type) {
  return type === 'secondary' || type === 'broadcast';
}

module.exports = function(type) {
  type = type || 'simple';
  var self = this;
  if (typeof window === 'undefined') {
    throw new Error("Tried to get form in non-browser context");
  }

  function getInput(type, idx) {
    var inputID = '_OneDBHostInput_' + type;
    if (isMultiType(type)) inputID += idx;
    return document.getElementById(inputID).value;
  }

  function getHost(type, idx) {
    let host = self.hosts[type];
    if (isMultiType(type)) host = host[idx];
    return host;
  }

  window._oneDBHelpers = window._oneDBHelpers || {
    showAdvanced: false,
    addHost: function(type) {
      var newHost = {location: DEFAULT_SECONDARY_LOCATION};
      self.hosts[type].push(newHost);
      self.getUser(newHost);
    },
    removeHost: function(type, idx) {
      self.hosts[type] = self.hosts[type].filter((h, i) => i !== idx);
      self.getUser(null);
    },
    updateHost: function(type, idx) {
      var host = getHost(type, idx);
      host.location = getInput(type, idx);
    },
    login: function(type, idx) {
      window._oneDBHelpers.updateHost(type, idx);
      var host = getHost(type, idx);
      if (type !== 'core') self.authorize(host);
    },
    logout: function(type, idx) {
      var host = getHost(type, idx);
      host.username = host.password = host.token = null;
      self.getUser(host);
    },
    toggleAdvancedOptions: function() {
      var el = document.getElementByClassName('_onedb_advanced');
      _oneDBHelpers.showAdvanced = !_oneDBHelpers.showAdvanced;
      if (_oneDBHelpers.showAdvanced) {
        el.setAttribute('style', '');
      } else {
        el.setAttribute('style', 'display: none');
      }
    }
  }

  if (type === 'hub_and_spoke' && !self.hosts.broadcast[0]) {
    window._oneDBHelpers.addHost('broadcast');
  }

  return TEMPLATES[type].bind(self)();
}

const TEMPLATES = {
  simple: function() {
    return `
${hostTemplate(this.hosts.primary, 'primary')}
    `
  },
  hub_and_spoke: function() {
    return `
<h4>Data Storage</h4>
<p>This is where your data will be stored.</p>
${hostTemplate(this.hosts.primary, 'primary')}
<h4>Community</h4>
<p>
  You'll be able to interact with other users who set this instance as their commmunity.
</p>
${hostTemplate(this.hosts.broadcast[0], 'broadcast')}
    `
  },
  advanced: function() {
    return `
<h4>Data Host</h4>
<p>This is where your data will be stored.</p>
${hostTemplate(this.hosts.primary, 'primary')}
<a href="javascript:void(0)" onclick="_oneDBHelpers.toggleAdvancedOptions()">Advanced options</a>
<div class="_onedb_advanced" style="${ _oneDBHelpers.showAdvanced ? '' : 'display: none'}">
  <hr>
  <h4>Broadcast Hosts</h4>
  <p>
    Changes to your data will be broadcast to these hosts.
    They won't store your data - they'll
    just get a link to the data on your primary host.
  </p>
  <p>
    Note: removing hosts may prevent you from continuing interactions with other users.
  </p>
  ${this.hosts.broadcast.map((host, idx) => hostTemplate(host, 'broadcast', idx)).join('\n')}
  <p>
    <button class="btn btn-secondary" onclick="_oneDBHelpers.addHost('broadcast')">Add a broadcast host</button>
  </p>
  <h4>Secondary Hosts</h4>
  <p>
    Use a secondary host to log into an instance that you might need to read private data from.
  </p>
  ${this.hosts.secondary.map((host, idx) => hostTemplate(host, 'secondary', idx)).join('\n')}
  <p>
    <button class="btn btn-secondary" onclick="_oneDBHelpers.addHost('secondary')">Add a broadcast host</button>
  </p>
  <h4>Core Host</h4>
  <p>
    The Core host contains data schemas and other information.
    Only change this if you know what you're doing.
    ${hostTemplate(this.hosts.core, 'core')}
  </p>
</div>
    `
  },
}

function hostTemplate(host, type, idx) {
  return `
<form onsubmit="_oneDBHelpers.login('${type}', ${idx}); return false">
  <div class="form-group">
    <div class="input-group">
      ${!isMultiType(type) ? '' : `
        <div class="input-group-prepend">
          <button class="btn btn-danger" type="button" onclick="_oneDBHelpers.removeHost('${type}', ${idx})">
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
          id="_OneDBHostInput_${type}${isMultiType(type) ? idx : ''}"
          onchange="_oneDBHelpers.updateHost('${type}', ${idx})">
      ${host.user ? `
        <div class="input-group-append">
          <button class="btn btn-outline-secondary" type="button"
                  onclick="_oneDBHelpers.logout('${type}', ${idx})">
            Log Out
          </button>
        </div>
      ` : `
        <div class="input-group-append">
          <button class="btn btn-outline-secondary" type="submit">
            ${ type === 'core' ? 'Set Host' : 'Log In' }
          </button>
        </div>
      `}
    </div>
  </div>
</form>
`
}
