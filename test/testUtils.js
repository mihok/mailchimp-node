'use strict';

// NOTE: testUtils should be require'd before anything else in each spec file!

require('mocha');
// Ensure we are using the 'as promised' libs before any tests are run:
require('chai').use(require('chai-as-promised'));

var utils = module.exports = {

  getUserMailchimpKey: function() {
    var key = process.env.MAILCHIMP_TEST_API_KEY || 'tGN0bIwXnHdwOa85VABjPdSn8nWY7G7I-us1';

    return key;
  },

  getUserMailchimpDataCenter: function () {
    var key = utils.getUserMailchimpKey();
    var keyDataCenter = key.split('-');
    var datacenter = (keyDataCenter.length > 1) ? keyDataCenter[1] : process.env.MAILCHIMP_TEST_DATACENTER || 'us0';

    return datacenter;
  },

  getSpyableMailchimp: function() {
    // Provide a testable mailchimp instance
    // That is, with mock-requests built in and hookable

    var mailchimp = require('../lib/mailchimp');
    var mailchimpInstance = mailchimp('fakeAuthToken');

    mailchimpInstance.REQUESTS = [];

    for (var i in mailchimpInstance) {
      if (mailchimpInstance[i] instanceof mailchimp.MailchimpResource) {
        // Override each _request method so we can make the params
        // available to consuming tests (revealing requests made on
        // REQUESTS and LAST_REQUEST):
        mailchimpInstance[i]._request = function(method, url, data, auth, options, cb) {
          var req = mailchimpInstance.LAST_REQUEST = {
            method: method,
            url: url,
            data: data,
            headers: options.headers || {},
          };
          if (auth) {
            req.auth = auth;
          }
          mailchimpInstance.REQUESTS.push(req);
          cb.call(this, null, {});
        };
      }
    }

    return mailchimpInstance;
  },

  /**
   * A utility where cleanup functions can be registered to be called post-spec.
   * CleanupUtility will automatically register on the mocha afterEach hook,
   * ensuring its called after each descendent-describe block.
   */
  CleanupUtility: (function() {
    CleanupUtility.DEFAULT_TIMEOUT = 20000;

    function CleanupUtility(timeout) {
      var self = this;
      this._cleanupFns = [];
      this._mailchimp = require('../lib/mailchimp')(
        utils.getUserMailchimpKey(),
        'latest'
      );
      afterEach(function(done) {
        this.timeout(timeout || CleanupUtility.DEFAULT_TIMEOUT);
        return self.doCleanup(done);
      });
    }

    CleanupUtility.prototype = {

      doCleanup: function(done) {
        var cleanups = this._cleanupFns;
        var total = cleanups.length;
        var completed = 0;
        for (var fn; (fn = cleanups.shift());) {
          var promise = fn.call(this);
          if (!promise || !promise.then) {
            throw new Error('CleanupUtility expects cleanup functions to return promises!');
          }
          promise.then(function() {
            // cleanup successful
            completed += 1;
            if (completed === total) {
              done();
            }
          }, function(err) {
            // not successful
            throw err;
          });
        }
        if (total === 0) {
          done();
        }
      },
      add: function(fn) {
        this._cleanupFns.push(fn);
      },
      deleteMember: function(memId, memHash) {
        this.add(function() {
          return this._mailchimp.lists.deleteMember(memId, memHash);
        });
      },
      deleteList: function(lId) {
        this.add(function() {
          return this._mailchimp.lists.del(lId);
        });
      },
    };

    return CleanupUtility;
  }()),

  /**
  * Get a random string for test Object creation
  */
  getRandomString: function() {
    return Math.random().toString(36).slice(2);
  },

};
