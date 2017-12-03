'use strict';

var MailchimpResource = require('../MailchimpResource');
// var utils = require('../utils');
var mailchimpMethod = MailchimpResource.method;

module.exports = MailchimpResource.extend({
  path: 'lists',
  includeBasic: ['create', 'list', 'retrieve', 'update', 'del'],

  createMember: mailchimpMethod({
    method: 'POST',
    path: '/{listId}/members',
    urlParams: ['listId'],
  }),

  deleteMember: mailchimpMethod({
    method: 'DELETE',
    path: '/{listId}/members/{subscriberHash}',
    urlParams: ['listId', 'subscriberHash'],
  }),
});
