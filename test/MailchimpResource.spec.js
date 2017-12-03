'use strict';

require('./testUtils');

var mailchimp = require('./testUtils').getSpyableMailchimp();
var expect = require('chai').expect;

describe('MailchimpResource', function() {
  describe('createResourcePathWithSymbols', function() {
    it('Generates a path', function() {
      mailchimp.lists.create({});
      var path = mailchimp.lists.createResourcePathWithSymbols('{id}');
      expect(path).to.equal('/lists/{id}');
    });
  });

  describe('_defaultHeaders', function() {
    it('sets the Authorization header with Bearer auth using the global API key', function() {
      var headers = mailchimp.lists._defaultHeaders(null, 0, null);
      // Mailchimp uses any username with the password, so we set username blank
      var basicAuthToken = new Buffer(':fakeAuthToken').toString('base64');
      expect(headers.Authorization).to.equal('Basic ' + basicAuthToken);
    });
    it('sets the Authorization header with Bearer auth using the specified API key', function() {
      var headers = mailchimp.lists._defaultHeaders('anotherFakeAuthToken', 0, null);
      expect(headers.Authorization).to.equal('Basic anotherFakeAuthToken');
    });
    it('sets the Mailchimp-Version header if an API version is provided', function() {
      var headers = mailchimp.lists._defaultHeaders(null, 0, '1970-01-01');
      expect(headers['Mailchimp-Version']).to.equal('1970-01-01');
    });
    it('does not the set the Mailchimp-Version header if no API version is provided', function() {
      var headers = mailchimp.lists._defaultHeaders(null, 0, null);
      expect(headers).to.not.include.keys('Mailchimp-Version');
    });
  });
});
