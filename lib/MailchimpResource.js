'use strict';

var http = require('http');
var https = require('https');
var path = require('path');

var utils = require('./utils');
var Error = require('./Error');

var hasOwn = {}.hasOwnProperty;

// Provide extension mechanism for Mailchimp Resource Sub-Classes
MailchimpResource.extend = utils.protoExtend;

// Expose method-creator & prepared (basic) methods
MailchimpResource.method = require('./MailchimpMethod');
MailchimpResource.BASIC_METHODS = require('./MailchimpMethod.basic');

/**
 * Encapsulates request logic for a Mailchimp Resource
 */
function MailchimpResource(mailchimp, urlData) {
  this._mailchimp = mailchimp;
  this._urlData = urlData || {};

  this.basePath = utils.makeURLInterpolator(mailchimp.getApiField('basePath'));
  this.resourcePath = this.path;
  this.path = utils.makeURLInterpolator(this.path);

  if (this.includeBasic) {
    this.includeBasic.forEach(function(methodName) {
      this[methodName] = MailchimpResource.BASIC_METHODS[methodName];
    }, this);
  }

  this.initialize.apply(this, arguments);
}

MailchimpResource.prototype = {

  path: '',

  initialize: function() {},

  // Function to override the default data processor. This allows full control
  // over how a MailchimpResource's request data will get converted into an HTTP
  // body. This is useful for non-standard HTTP requests. The function should
  // take method name, data, and headers as arguments.
  requestDataProcessor: null,

  // String that overrides the base API endpoint. If `overrideHost` is not null
  // then all requests for a particular resource will be sent to a base API
  // endpoint as defined by `overrideHost`.
  overrideHost: null,

  // Function to add a validation checks before sending the request, errors should
  // be thrown, and they will be passed to the callback/promise.
  validateRequest: null,

  createFullPath: function(commandPath, urlData) {
    return path.join(
      this.basePath(urlData),
      this.path(urlData),
      typeof commandPath == 'function' ?
        commandPath(urlData) : commandPath
    ).replace(/\\/g, '/'); // ugly workaround for Windows
  },

  // Creates a relative resource path with symbols left in (unlike
  // createFullPath which takes some data to replace them with). For example it
  // might produce: /invoices/{id}
  createResourcePathWithSymbols: function(pathWithSymbols) {
    return '/' + path.join(
      this.resourcePath,
      pathWithSymbols
    ).replace(/\\/g, '/'); // ugly workaround for Windows
  },

  createUrlData: function() {
    var urlData = {};
    // Merge in baseData
    for (var i in this._urlData) {
      if (hasOwn.call(this._urlData, i)) {
        urlData[i] = this._urlData[i];
      }
    }
    return urlData;
  },

  wrapTimeout: function(promise, callback) {
    if (callback) {
      // Ensure callback is called outside of promise stack.
      return promise.then(function(res) {
        setTimeout(function() { callback(null, res) }, 0);
      }, function(err) {
        setTimeout(function() { callback(err, null); }, 0);
      });
    }

    return promise;
  },

  _timeoutHandler: function(timeout, req, callback) {
    var self = this;
    return function() {
      var timeoutErr = new Error('ETIMEDOUT');
      timeoutErr.code = 'ETIMEDOUT';

      req._isAborted = true;
      req.abort();

      callback.call(
        self,
        new Error.MailchimpConnectionError({
          message: 'Request aborted due to timeout being reached (' + timeout + 'ms)',
          detail: timeoutErr,
        }),
        null
      );
    }
  },

  _responseHandler: function(req, callback) {
    var self = this;
    return function(res) {
      var response = '';

      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        response += chunk;
      });
      res.on('end', function() {
        var headers = res.headers || {};
        // NOTE: Mailchimp responds with lowercase header names/keys.
        // For convenience, make Request-Id easily accessible on
        // lastResponse.
        // Mailchimp uses X-Request-Id
        res.requestId = headers['x-request-id'];

        var responseEvent = utils.removeEmpty({
          api_version: headers['Mailchimp-version'],
          account: headers['Mailchimp-account'],
          idempotency_key: headers['idempotency-key'],
          method: req._requestEvent.method,
          path: req._requestEvent.path,
          status: res.statusCode,
          request_id: res.requestId,
          elapsed: Date.now() - req._requestStart,
        });

        self._mailchimp._emitter.emit('response', responseEvent);

        try {
          response = JSON.parse(response.length > 0 ? response : '{}');

          // Response codes dictate errors
          if (response.status >= 400 && response.status < 600) {
            var err;

            response.headers = headers;
            response.statusCode = res.statusCode;
            response.requestId = res.requestId;
            // TODO: Mailchimp sends error information a bit differently than
            //  the forked library Stripe did
            response.code = res.response.title.toLowerCase().replace(/\s/, '_');
            response.message = res.response.title;

            if (res.statusCode === 400) {
              err = new Error.MailchimpInvalidRequestError(response);
            } else if (res.statusCode === 401) {
              err = new Error.MailchimpAuthenticationError(response);
            } else if (res.statusCode === 403) {
              err = new Error.MailchimpPermissionError(response);
            } else if (res.statusCode === 429) {
              err = new Error.MailchimpRateLimitError(response);
            } else {
              err = Error.MailchimpError.generate(response);
            }
            return callback.call(self, err, null);
          }
        } catch (e) {
          return callback.call(
            self,
            new Error.MailchimpAPIError({
              message: 'Invalid JSON received from the Mailchimp API',
              detail: 'Invalid JSON received from the Mailchimp API',
              response: response,
              exception: e,
              requestId: headers['x-request-id'],
            }),
            null
          );
        }
        // Expose res object
        Object.defineProperty(response, 'lastResponse', {
          enumerable: false,
          writable: false,
          value: res,
        });
        callback.call(self, null, response);
      });
    };
  },

  _errorHandler: function(req, callback) {
    var self = this;
    return function(error) {
      if (req._isAborted) {
        // already handled
        return;
      }
      callback.call(
        self,
        new Error.MailchimpConnectionError({
          message: 'An error occurred with our connection to Mailchimp',
          detail: error,
        }),
        null
      );
    }
  },

  _defaultHeaders: function(auth, contentLength, apiVersion) {
    var userAgentString = 'Mailchimp/v1 NodeBindings/' + this._mailchimp.getConstant('PACKAGE_VERSION');

    if (this._mailchimp._appInfo) {
      userAgentString += ' ' + this._mailchimp.getAppInfoAsString();
    }

    var headers = {
      // Use specified auth token or use default from this Mailchimp instance:
      'Authorization': auth ?
        'Basic ' + auth :
        this._mailchimp.getApiField('auth'),
      'Accept': 'application/json',
      'Content-Type': 'application/json', // 'application/x-www-form-urlencoded',
      'Content-Length': contentLength,
      'User-Agent': userAgentString,
    };

    if (apiVersion) {
      headers['Mailchimp-Version'] = apiVersion;
    }

    return headers;
  },

  _request: function(method, path, data, auth, options, callback) {
    var self = this;
    var requestData;

    if (self.requestDataProcessor) {
      requestData = self.requestDataProcessor(method, data, options.headers);
    } else {
      requestData = utils.stringifyRequestData(data || {});
    }

    var apiVersion = this._mailchimp.getApiField('version');

    var headers = self._defaultHeaders(auth, requestData.length, apiVersion);

    // Grab client-user-agent before making the request:
    this._mailchimp.getClientUserAgent(function(cua) {
      headers['X-Mailchimp-Client-User-Agent'] = cua;

      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      makeRequest();
    });

    function makeRequest() {
      var timeout = self._mailchimp.getApiField('timeout');
      var isInsecureConnection = self._mailchimp.getApiField('protocol') == 'http';

      var host = self.overrideHost || self._mailchimp.getApiHost();
      var req = (
        isInsecureConnection ? http : https
      ).request({
        host: host,
        port: self._mailchimp.getApiField('port'),
        path: path,
        method: method,
        agent: self._mailchimp.getApiField('agent'),
        headers: headers,
        ciphers: 'DEFAULT:!aNULL:!eNULL:!LOW:!EXPORT:!SSLv2:!MD5',
      });

      var requestEvent = utils.removeEmpty({
        api_version: apiVersion,
        account: headers['Mailchimp-Account'],
        idempotency_key: headers['Idempotency-Key'],
        method: method,
        path: path,
      });

      req._requestEvent = requestEvent;

      req._requestStart = Date.now();

      self._mailchimp._emitter.emit('request', requestEvent);

      req.setTimeout(timeout, self._timeoutHandler(timeout, req, callback));
      req.on('response', self._responseHandler(req, callback));
      req.on('error', self._errorHandler(req, callback));

      req.on('socket', function(socket) {
        socket.on((isInsecureConnection ? 'connect' : 'secureConnect'), function() {
          // Send payload; we're safe:
          req.write(requestData);

          req.end();
        });
      });
    }
  },

};

module.exports = MailchimpResource;
