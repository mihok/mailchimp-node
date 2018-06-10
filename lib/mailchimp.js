'use strict';

Mailchimp.DEFAULT_HOST = 'api.mailchimp.com';
Mailchimp.DEFAULT_PORT = '443';
Mailchimp.DEFAULT_BASE_PATH = '/3.0/';
Mailchimp.DEFAULT_API_VERSION = null;
Mailchimp.DEFAULT_API_DATACENTER = null;

// Use node's default timeout:
Mailchimp.DEFAULT_TIMEOUT = require('http').createServer().timeout;

Mailchimp.PACKAGE_VERSION = require('../package.json').version;

Mailchimp.USER_AGENT = {
  bindings_version: Mailchimp.PACKAGE_VERSION,
  lang: 'node',
  lang_version: process.version,
  platform: process.platform,
  publisher: 'Mailchimp',
  uname: null,
};

Mailchimp.USER_AGENT_SERIALIZED = null;

var APP_INFO_PROPERTIES = ['name', 'version', 'url'];

var EventEmitter = require('events').EventEmitter;
var exec = require('child_process').exec;

var resources = {
  Lists: require('./resources/Lists'),
  // Subscriptions: require('./resources/Subscriptions'),
  // SubscriptionItems: require('./resources/SubscriptionItems'),
};

Mailchimp.MailchimpResource = require('./MailchimpResource');
Mailchimp.resources = resources;

function Mailchimp(key, version) {
  if (!(this instanceof Mailchimp)) {
    return new Mailchimp(key, version);
  }

  Object.defineProperty(this, '_emitter', {
    value: new EventEmitter(),
    enumerable: false,
    configurable: false,
    writeable: false,
  });

  this.on = this._emitter.on.bind(this._emitter);
  this.off = this._emitter.removeListener.bind(this._emitter);

  this._api = {
    auth: null,
    host: Mailchimp.DEFAULT_HOST,
    port: Mailchimp.DEFAULT_PORT,
    basePath: Mailchimp.DEFAULT_BASE_PATH,
    version: Mailchimp.DEFAULT_API_VERSION,
    datacenter: Mailchimp.DEFAILT_API_DATACENTER,
    timeout: Mailchimp.DEFAULT_TIMEOUT,
    agent: null,
    dev: false,
  };

  this._prepResources();
  this.setApiKey(key);
  this.setApiVersion(version);
  // this.setApiDataCenter(datacenter);

  this.errors = require('./Errors');
  this.webhooks = require('./Webhooks');
}

Mailchimp.prototype = {

  setHost: function(host, port, protocol) {
    this._setApiField('host', host);
    if (port) {
      this.setPort(port);
    }
    if (protocol) {
      this.setProtocol(protocol);
    }
  },

  setProtocol: function(protocol) {
    this._setApiField('protocol', protocol.toLowerCase());
  },

  setPort: function(port) {
    this._setApiField('port', port);
  },

  setApiVersion: function(version) {
    if (version) {
      this._setApiField('version', version);
    }
  },

  setApiDataCenter: function (datacenter) {
    if (datacenter) {
      this._setApiField('datacenter', datacenter);
    }
  },

  setApiKey: function(key) {
    if (key) {
      // Mailchimp takes any username and the API key as the password for
      //  basic auth
      var keyBuffer = new Buffer(':' + key);

      this._setApiField(
        'auth',
        'Basic ' + keyBuffer.toString('base64')
      );

      var keyDataCenter = key.split('-');

      if (keyDataCenter.length > 1) {
        this.setApiDataCenter(keyDataCenter[1]);
      }
    }
  },

  setTimeout: function(timeout) {
    this._setApiField(
      'timeout',
      timeout == null ? Mailchimp.DEFAULT_TIMEOUT : timeout
    );
  },

  setAppInfo: function(info) {
    if (info && typeof info !== 'object') {
      throw new Error('AppInfo must be an object.');
    }

    if (info && !info.name) {
      throw new Error('AppInfo.name is required');
    }

    info = info || {};

    var appInfo = APP_INFO_PROPERTIES.reduce(function(accum, prop) {
      if (typeof info[prop] == 'string') {
        accum = accum || {};

        accum[prop] = info[prop];
      }

      return accum;
    }, undefined);

    // Kill the cached UA string because it may no longer be valid
    Mailchimp.USER_AGENT_SERIALIZED = undefined;

    this._appInfo = appInfo;
  },

  setHttpAgent: function(agent) {
    this._setApiField('agent', agent);
  },

  _setApiField: function(key, value) {
    this._api[key] = value;
  },

  getApiField: function(key) {
    return this._api[key];
  },

  getApiHost: function () {
    return this.getApiField('datacenter') + '.' + this.getApiField('host');
  },

  getConstant: function(c) {
    return Mailchimp[c];
  },

  // Gets a JSON version of a User-Agent and uses a cached version for a slight
  // speed advantage.
  getClientUserAgent: function(cb) {
    if (Mailchimp.USER_AGENT_SERIALIZED) {
      return cb(Mailchimp.USER_AGENT_SERIALIZED);
    }
    this.getClientUserAgentSeeded(Mailchimp.USER_AGENT, function(cua) {
      Mailchimp.USER_AGENT_SERIALIZED = cua;
      cb(Mailchimp.USER_AGENT_SERIALIZED);
    })
  },

  // Gets a JSON version of a User-Agent by encoding a seeded object and
  // fetching a uname from the system.
  getClientUserAgentSeeded: function(seed, cb) {
    var self = this;

    exec('uname -a', function(err, uname) {
      var userAgent = {};
      for (var field in seed) {
        userAgent[field] = encodeURIComponent(seed[field]);
      }

      // URI-encode in case there are unusual characters in the system's uname.
      userAgent.uname = encodeURIComponent(uname) || 'UNKNOWN';

      if (self._appInfo) {
        userAgent.application = self._appInfo;
      }

      cb(JSON.stringify(userAgent));
    });
  },

  getAppInfoAsString: function() {
    if (!this._appInfo) {
      return '';
    }

    var formatted = this._appInfo.name;

    if (this._appInfo.version) {
      formatted += '/' + this._appInfo.version;
    }

    if (this._appInfo.url) {
      formatted += ' (' + this._appInfo.url + ')';
    }

    return formatted;
  },

  _prepResources: function() {
    for (var name in resources) {
      this[
        name[0].toLowerCase() + name.substring(1)
      ] = new resources[name](this);
    }
  },

};

module.exports = Mailchimp;
// expose constructor as a named property to enable mocking with Sinon.JS
module.exports.Mailchimp = Mailchimp;
