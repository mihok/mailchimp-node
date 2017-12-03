# Mailchimp Node.js Library
 
[![Version](https://img.shields.io/npm/v/mailchimp-node.svg)](https://www.npmjs.org/package/mailchimp-node)
[![Build Status](https://travis-ci.org/mihok/mailchimp-node.svg?branch=master)](https://travis-ci.org/mihok/mailchimp-node)
[![Downloads](https://img.shields.io/npm/dm/mailchimp-node.svg)](https://www.npmjs.com/package/mailchimp-node)
[![Try on RunKit](https://badge.runkitcdn.com/mailchimp-node.svg)](https://runkit.com/npm/mailchimp-node)

A Mailchimp Node library provides convenient access to the Mailchimo API from
applications written in server-side JavaScript.

This library uses Mailchimp API v3.0

Forked from the excellent [Stripe Node library](https://github.com/stripe/stripe-node)

<!--
## Documentation

See the [Node API docs](https://mailchimp.com/docs/api/node#intro).
-->
## Installation
 
Install the package with:

    npm install mailchimp-node --save

# # Usage

The package needs to be configured with your account's secret key which is
available in your [Mailchimp Dashboard][api-keys]. Require it with the key's
value:

``` js
var mailchimp = require('mailchimp-node')('sk_test_...');

mailchimp.list.createMember(
  'exampleListHash',
  { email: 'subscriber@example.com', status: 'subscribed' },
  function(err, subscriber) {
    err; // null if no error occurred
    subscriber; // the created subscriber object
  }
);
```

Or using ES modules, this looks more like:

``` js
import mailchimpPackage from 'mailchimp';
const mailchimp = mailchimpPackage('sk_test_...');
```

### Using Promises
 
Every method returns a chainable promise which can be used instead of a regular
callback:

``` js
// Create a new subscriber and then a new charge for that subscriber:
mailchimp.list.create({
  name: 'Foobar Johnson',
  contact: {
    company: 'Foobar Inc.',
    address1: '123 Foobar Street',
    city: 'Foocity',
    state: 'Foostate',
    zip: 01234,
    country: 'US',
  },
  permission_reminder: '',
  campaign_defaults: {
    from_name: 'Foobar Johnson',
    from_email: 'foo123johnson@example.com',
    subject: 'Default Foobar Subject',
    language: 'eng',
  },
  email_type_option: false,
}).then(function(list){
  return mailchimp.list.createMember(list.id, {
    email: 'bob@example.com',
    status: 'subscribed',
  });
}).then(function(subscriber) {
  // New subscriber
}).catch(function(err) {
  // Deal with an error
});
```

### Configuring Timeout

Request timeout is configurable (the default is Node's default of 120 seconds):

``` js
mailchimp.setTimeout(20000); // in ms (this is 20 seconds)
```
<!--
### Configuring For Connect

A per-request `mailchimp-Account` header for use with [mailchimp Connect][connect]
can be added to any method:

``` js
// Retrieve the balance for a connected account:
mailchimp.balance.retrieve({
  mailchimp_account: 'acct_foo'
}).then(function(balance) {
  // The balance object for the connected account
}).catch(function(err) {
  // Error
});
```
-->
### Configuring a Proxy

An [https-proxy-agent][https-proxy-agent] can be configured with
`setHttpAgent`.

To use mailchimp behind a proxy you can pass  to sdk:

```js
if (process.env.http_proxy) {
  const ProxyAgent = require('https-proxy-agent');
  mailchimp.setHttpAgent(new ProxyAgent(process.env.http_proxy));
}
```

### Examining Responses

Some information about the response which generated a resource is available
with the `lastResponse` property:

```js
charge.lastResponse.requestId // see: https://mailchimp.com/docs/api/node#request_ids
charge.lastResponse.statusCode
```

### `request` and `response` events

The mailchimp object emits `request` and `response` events.  You can use them like this:

```js
var mailchimp = require('mailchimp')('sk_test_...');

function onRequest(request) {
  // Do something.
}

// Add the event handler function:
mailchimp.on('request', onRequest);

// Remove the event handler function:
mailchimp.off('request', onRequest);
```

#### `request` object
```js
{
  api_version: 'latest',
  account: 'acct_TEST',       // Only present if provided
  idempotency_key: 'abc123',  // Only present if provided
  method: 'POST',
  path: '/v1/charges'
}
```

#### `response` object
```js
{
  api_version: 'latest',
  account: 'acct_TEST',       // Only present if provided
  idempotency_key: 'abc123',  // Only present if provided
  method: 'POST',
  path: '/v1/charges',
  status: 402,
  request_id: 'req_Ghc9r26ts73DRf',
  elapsed: 445                // Elapsed time in milliseconds
}
```

### Webhook signing

mailchimp can optionally sign the webhook events it sends to your endpoint, allowing you to validate that they were not sent by a third-party.  You can read more about it [here](https://mailchimp.com/docs/webhooks#signatures).

Please note that you must pass the _raw_ request body, exactly as received from mailchimp, to the `constructEvent()` function; this will not work with a parsed (i.e., JSON) request body.

You can find an example of how to use this with [Express](https://expressjs.com/) in the [`examples/webhook-signing`](examples/webhook-signing) folder, but here's what it looks like:

```js
event = mailchimp.webhooks.constructEvent(
  webhookRawBody,
  webhookmailchimpSignatureHeader,
  webhookSecret
);
```

### Writing a Plugin

If you're writing a plugin that uses the library, we'd appreciate it if you identified using `mailchimp.setAppInfo()`:

```js
mailchimp.setAppInfo({
  name: 'MyAwesomePlugin',
  version: '1.2.34', // Optional
  url: 'https://myawesomeplugin.info', // Optional
});
```

This information is passed along when the library makes calls to the mailchimp API.

## More Information

 * [REST API Version](https://github.com/mailchimp/mailchimp-node/wiki/REST-API-Version)
 * [Error Handling](https://github.com/mailchimp/mailchimp-node/wiki/Error-Handling)
 * [Passing Options](https://github.com/mailchimp/mailchimp-node/wiki/Passing-Options)
 * [Using mailchimp Connect](https://github.com/mailchimp/mailchimp-node/wiki/Using-mailchimp-Connect-with-node.js)

## Development

Run all tests:

```bash
$ npm install
$ npm test
```

Run a single test suite:

```bash
$ npm run mocha -- test/Error.spec.js
```

Run a single test (case sensitive):

```bash
$ npm run mocha -- test/Error.spec.js --grep 'Populates with type'
```

If you wish, you may run tests using your mailchimp *Test* API key by setting the
environment variable `MAILCHIMP_TEST_API_KEY` before running the tests:

```bash
$ export mailchimp_TEST_API_KEY='sk_test....'
$ npm test
```

[api-keys]: https://admin.mailchimp.com/account/api
<!-- [connect]: https://mailchimp.com/connect -->
[https-proxy-agent]: https://github.com/TooTallNate/node-https-proxy-agent

<!--
# vim: set tw=79:
-->
