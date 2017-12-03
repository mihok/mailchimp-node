'use strict';

var testUtils = require('./testUtils');
var crypto = require('crypto');
var mailchimp = require('../lib/mailchimp')(
  testUtils.getUserMailchimpKey(),
  'latest',
  testUtils.getUserMailchimpDataCenter()
);

var expect = require('chai').expect;

function randomNum (low, high) {
  var result = Math.random()
  var delta = high - low;

  result *= delta;
  return result + low;
}

var LIST_ID = '6b1535640e';
var LIST_MEMBER_DETAILS = {
  // Generate a random email due to Mailchimp complaining after multiple retries
  email_address: 'customer-' + randomNum(1, 99999) + '@email.com',
  status: 'subscribed',
};

describe('Mailchimp Module', function() {
  var cleanup = new testUtils.CleanupUtility();
  this.timeout(20000);

  describe('setApiKey', function() {
    it('uses Basic auth', function() {
      var basicAuthToken = new Buffer(':' + testUtils.getUserMailchimpKey()).toString('base64');
      expect(mailchimp.getApiField('auth')).to.equal('Basic ' + basicAuthToken);
    });
  });

  describe('GetClientUserAgent', function() {
    it('Should return a user-agent serialized JSON object', function() {
      return expect(new Promise(function(resolve, reject) {
        mailchimp.getClientUserAgent(function(c) {
          resolve(JSON.parse(c));
        });
      })).to.eventually.have.property('lang', 'node');
    });
  });

  describe('GetClientUserAgentSeeded', function() {
    it('Should return a user-agent serialized JSON object', function() {
      var userAgent = {lang: 'node'};
      return expect(new Promise(function(resolve, reject) {
        mailchimp.getClientUserAgentSeeded(userAgent, function(c) {
          resolve(JSON.parse(c));
        });
      })).to.eventually.have.property('lang', 'node');
    });

    it('Should URI-encode user-agent fields', function() {
      var userAgent = {lang: 'ï'};
      return expect(new Promise(function(resolve, reject) {
        mailchimp.getClientUserAgentSeeded(userAgent, function(c) {
          resolve(JSON.parse(c));
        });
      })).to.eventually.have.property('lang', '%C3%AF');
    })
  });

  describe('setTimeout', function() {
    it('Should define a default equal to the node default', function() {
      expect(mailchimp.getApiField('timeout')).to.equal(require('http').createServer().timeout);
    });
    it('Should allow me to set a custom timeout', function() {
      mailchimp.setTimeout(900);
      expect(mailchimp.getApiField('timeout')).to.equal(900);
    });
    it('Should allow me to set null, to reset to the default', function() {
      mailchimp.setTimeout(null);
      expect(mailchimp.getApiField('timeout')).to.equal(require('http').createServer().timeout);
    });
  });

  describe('setAppInfo', function() {
    describe('when given nothing or an empty object', function() {
      it('should unset mailchimp._appInfo', function() {
        mailchimp.setAppInfo();
        expect(mailchimp._appInfo).to.be.undefined;
      });
    });

    describe('when given an object with no `name`', function() {
      it('should throw an error', function() {
        expect(function() {
          mailchimp.setAppInfo({});
        }).to.throw(/AppInfo.name is required/);

        expect(function() {
          mailchimp.setAppInfo({
            version: '1.2.3',
          });
        }).to.throw(/AppInfo.name is required/);

        expect(function() {
          mailchimp.setAppInfo({
            cats: '42',
          });
        }).to.throw(/AppInfo.name is required/);
      });
    });

    describe('when given at least a `name`', function() {
      it('should set name, version and url of mailchimp._appInfo', function() {
        mailchimp.setAppInfo({
          name: 'MyAwesomeApp',
        });
        expect(mailchimp._appInfo).to.eql({
          name: 'MyAwesomeApp',
        });

        mailchimp.setAppInfo({
          name: 'MyAwesomeApp',
          version: '1.2.345',
        });
        expect(mailchimp._appInfo).to.eql({
          name: 'MyAwesomeApp',
          version: '1.2.345',
        });

        mailchimp.setAppInfo({
          name: 'MyAwesomeApp',
          url: 'https://myawesomeapp.info',
        });
        expect(mailchimp._appInfo).to.eql({
          name: 'MyAwesomeApp',
          url: 'https://myawesomeapp.info',
        });
      });

      it('should ignore any invalid properties', function() {
        mailchimp.setAppInfo({
          name: 'MyAwesomeApp',
          version: '1.2.345',
          url: 'https://myawesomeapp.info',
          countOfRadishes: 512,
        });
        expect(mailchimp._appInfo).to.eql({
          name: 'MyAwesomeApp',
          version: '1.2.345',
          url: 'https://myawesomeapp.info',
        });
      });
    });

    it('should be included in the ClientUserAgent and be added to the UserAgent String', function(done) {
      var appInfo = {
        name: testUtils.getRandomString(),
        version: '1.2.345',
        url: 'https://myawesomeapp.info',
      };

      mailchimp.setAppInfo(appInfo);

      mailchimp.getClientUserAgent(function(uaString) {
        expect(JSON.parse(uaString).application).to.eql(appInfo);

        expect(mailchimp.getAppInfoAsString()).to.eql(appInfo.name + '/' + appInfo.version + ' (' + appInfo.url + ')');

        done();
      });
    });
  });

  describe('Callback support', function() {
    describe('Any given endpoint', function() {
      it('Will call a callback if successful', function() {
        return expect(new Promise(function(resolve, reject) {
          mailchimp.lists.createMember(LIST_ID, LIST_MEMBER_DETAILS, function(err, member) {
            cleanup.deleteMember(LIST_ID, crypto.createHash('md5').update(LIST_MEMBER_DETAILS.email_address).digest('hex'));
            resolve('Called!');
          });
        })).to.eventually.equal('Called!');
      });

      it('Will expose HTTP response object', function() {
        return expect(new Promise(function(resolve, reject) {
          mailchimp.lists.createMember(LIST_ID, LIST_MEMBER_DETAILS, function(err, member) {
            cleanup.deleteMember(LIST_ID, crypto.createHash('md5').update(LIST_MEMBER_DETAILS.email_address).digest('hex'));


            var headers = member.lastResponse.headers;
            expect(headers).to.contain.keys('x-request-id');

            // expect(member.lastResponse.requestId).to.match(/^req_/);
            // expect(member.lastResponse.statusCode).to.equal(200);

            resolve('Called!');
          });
        })).to.eventually.equal('Called!');
      });

      it('Given an error the callback will receive it', function() {
        return expect(new Promise(function(resolve, reject) {
          mailchimp.lists.createMember('nonExistentListId', {email: ''}, function(err, member) {
            if (err) {
              resolve('ErrorWasPassed');
            } else {
              reject(new Error('NoErrorPassed'));
            }
          });
        })).to.eventually.become('ErrorWasPassed');
      });
    });
  });
});
