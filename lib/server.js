'use strict';

var _compression = require('compression');

var _compression2 = _interopRequireDefault(_compression);

var _ddos = require('ddos');

var _ddos2 = _interopRequireDefault(_ddos);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _busboyBodyParser = require('busboy-body-parser');

var _busboyBodyParser2 = _interopRequireDefault(_busboyBodyParser);

var _cookieParser = require('cookie-parser');

var _cookieParser2 = _interopRequireDefault(_cookieParser);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _rest = require('./rest');

var _rest2 = _interopRequireDefault(_rest);

var _throng = require('throng');

var _throng2 = _interopRequireDefault(_throng);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// increase ddos burst to avoid false positives with this app
// (C) Copyright 2014-2016 Hewlett Packard Enterprise Development LP

var ddos = new _ddos2.default({ burst: 80 });


var ATLAS_SERVER = undefined;

var PORT = process.env.PORT || 8101;
var PREFIX = process.env.PREFIX ? '/' + process.env.PREFIX + '/' : '/';

// This allows for a self signed certificate from Atlas
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var WORKERS = process.env.WEB_CONCURRENCY || 1;

(0, _throng2.default)(WORKERS, start);

function start() {
  var app = (0, _express2.default)();

  app.use(ddos.express);

  app.use((0, _compression2.default)());

  app.use((0, _cookieParser2.default)());

  app.use((0, _morgan2.default)('tiny'));

  app.use(_bodyParser2.default.json());

  app.use((0, _busboyBodyParser2.default)());

  if (!ATLAS_SERVER) {

    // Simulate REST API
    app.use('/rest', _rest2.default.router);
    //// generator.generate();
  } else {

    // Proxy /rest requests to another server

    app.get('/rest/*', function (req, res) {
      var options = {
        host: ATLAS_SERVER,
        path: req.url,
        method: 'GET',
        headers: req.headers
      };
      var data = '';

      var creq = _https2.default.request(options, function (cres) {
        cres.setEncoding('utf8');
        cres.on('data', function (chunk) {
          data += chunk;
        });
        cres.on('close', function () {
          res.status(cres.statusCode).send(data);
        });
        cres.on('end', function () {
          res.status(cres.statusCode).send(data);
        });
      }).on('error', function (e) {
        console.log('!!! error', e.message);
        res.status(500).send(e.message);
      });
      creq.end();
    });

    app.post('/rest/*', function (req, res) {
      var options = {
        host: ATLAS_SERVER,
        path: req.url,
        method: 'POST',
        headers: req.headers
      };
      var data = '';

      var creq = _https2.default.request(options, function (cres) {
        // set encoding
        cres.setEncoding('utf8');
        res.append('Content-Type', 'application/json');
        // wait for data
        cres.on('data', function (chunk) {
          data += chunk;
        });
        cres.on('close', function () {
          res.status(cres.statusCode).send(data);
        });
        cres.on('end', function () {
          res.status(cres.statusCode).send(data);
        });
      }).on('error', function (e) {
        console.log('!!! error', e.message);
        res.status(500).send(e.message);
      });
      creq.write(JSON.stringify(req.body), function (err) {
        creq.end();
      });
    });
  }

  // UI serving

  app.use('/', _express2.default.static(_path2.default.join(__dirname, '/../dist')));
  app.get('/*', function (req, res) {
    res.sendFile(_path2.default.resolve(_path2.default.join(__dirname, '/../dist/index.html')));
  });

  var server = _http2.default.createServer(app);

  _rest2.default.setup(server, PREFIX);

  server.listen(PORT);

  console.log('Server started, listening at: http://localhost:' + PORT + ', proxying to ' + ATLAS_SERVER);
}