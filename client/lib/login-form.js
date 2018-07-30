const DEFAULT_SECONDARY_LOCATION = 'http://localhost:4000';

module.exports = function() {
  if (typeof window === 'undefined') {
    throw new Error("Tried to get form in non-browser context");
  }
  var self = this;
  window.freeDBAddHost = function() {
    let newHost = {location: DEFAULT_SECONDARY_LOCATION};
    self.hosts.secondary.push(newHost);
    self.getUser(newHost);
  }
  window.freeDBRemoveHost = function(idx) {
    self.hosts.secondary = self.hosts.secondary.filter((h, i) => i !== idx);
    self.getUser(null);
  }

  function getInput(idx) {
    var inputID = 'FreeDBHost';
    if (idx >= 0) inputID += idx;
    return document.getElementById(inputID).value;
  }

  function getHost(idx) {
    return idx === -1 ? self.hosts.primary : self.hosts.secondary[idx];
  }

  window.freeDBUpdate = function(idx) {
    var host = getHost(idx);
    host.location = getInput(idx);
  }
  window.freeDBLogin = function (idx) {
    freeDBUpdate(idx);
    self.authorize(host);
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
<a class="btn btn-secondary" onclick="window.freeDBAddHost()">Add a secondary host</a>
`
}

function hostTemplate(host, idx) {
  return `
<form onsubmit="freeDBLogin(${idx})">
  <div class="form-group">
    <div class="input-group">
      ${idx === -1 ? '' : `
        <div class="input-group-prepend">
          <button class="btn btn-danger" onclick="freeDBRemoveHost(${idx})" type="button">
            &times;
          </button>
        </div>
      `}
      <input
          class="form-control"
          value="${host.location}"
          id="FreeDBHost${idx >= 0 ? idx : ''}"
          onchange="freeDBUpdate(${idx})">
      <div class="input-group-append">
        <button class="btn btn-outline-secondary" type="submit">
          Log In
        </button>
      </div>
    </div>
    <p>
      ${host.user ? "Signed in as " + host.displayName : ""}
    </p>
  </div>
</form>
`
}
