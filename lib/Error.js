'use strict';

var utils = require('./utils');

module.exports = _Error;

/**
 * Generic Error klass to wrap any errors returned by mailchimp-node
 */
function _Error(raw) {
  this.populate.apply(this, arguments);
  this.stack = (new Error(this.detail)).stack;
}

// Extend Native Error
_Error.prototype = Object.create(Error.prototype);

_Error.prototype.type = 'GenericError';
_Error.prototype.populate = function(type, message) {
  this.type = type;
  this.message = message;
  this.detail = message;
};

_Error.extend = utils.protoExtend;

/**
 * Create subclass of internal Error klass
 * (Specifically for errors returned from Mailchimp's REST API)
 */
var MailchimpError = _Error.MailchimpError = _Error.extend({
  type: 'MailchimpError',
  populate: function(raw) {
    // Move from prototype def (so it appears in stringified obj)
    this.type = this.type;

    this.stack = (new Error(raw.message)).stack;
    this.rawType = raw.type;
    this.code = raw.code;
    this.param = raw.param;
    this.message = raw.message;
    this.detail = raw.detail;
    this.raw = raw;
    this.headers = raw.headers;
    this.requestId = raw.requestId;
    this.statusCode = raw.statusCode;
  },
});

/**
 * Helper factory which takes raw mailchimp errors and outputs wrapping instances
 */
MailchimpError.generate = function(rawMailchimpError) {
  // TODO: Add more Error types based Mailchimp's error glossary:
  //  https://developer.mailchimp.com/documentation/mailchimp/guides/error-glossary/
  switch (rawMailchimpError.title) {
  // case 'list_error':i
  //   return new _Error.MailchimpListError(rawMailchimpError);
  case 'Resource Not Found':
  case 'Invalid Resource':
    return new _Error.MailchimpInvalidRequestError(rawMailchimpError);
  case 'API Key Missing':
  case 'API Key Invalid':
    return new _Error.MailchimpAuthenticationError(rawMailchimpError);
    // case 'api_error':
    //   return new _Error.MailchimpAPIError(rawMailchimpError);
    // case 'idempotency_error':
    //   return new _Error.MailchimpIdempotencyError(rawMailchimpError);
  }
  return new _Error('Generic', 'Unknown Error');
};

// Specific Mailchimp Error types:
_Error.MailchimpListError = MailchimpError.extend({type: 'MailchimpListError'});
_Error.MailchimpInvalidRequestError = MailchimpError.extend({type: 'MailchimpInvalidRequestError'});
_Error.MailchimpAPIError = MailchimpError.extend({type: 'MailchimpAPIError'});
_Error.MailchimpAuthenticationError = MailchimpError.extend({type: 'MailchimpAuthenticationError'});
_Error.MailchimpPermissionError = MailchimpError.extend({type: 'MailchimpPermissionError'});
_Error.MailchimpRateLimitError = MailchimpError.extend({type: 'MailchimpRateLimitError'});
_Error.MailchimpConnectionError = MailchimpError.extend({type: 'MailchimpConnectionError'});
_Error.MailchimpSignatureVerificationError = MailchimpError.extend({type: 'MailchimpSignatureVerificationError'});
_Error.MailchimpIdempotencyError = MailchimpError.extend({type: 'MailchimpIdempotencyError'});
