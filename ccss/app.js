// Copyright 2012 Navigation North Learning Solutions LLC
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
// License for the specific language governing permissions and limitations under
// the License.

var express  = require('express');
var mustache = require('mustache');
var config   = require('config');
var routes = require('./routes');
var publishers = require("./routes/publishers");
var tmpl = { // template functions to render with mustache
    compile: function (source, options) {
        if (typeof source == 'string') {
            return function(options) {
                options.locals = options.locals || {};
                options.partials = options.partials || {};

                if (options.body) // for express.js > v1.0
                    options.partials.body = options.body;

                return mustache.to_html(
                    source, options.locals, options.partials);
            };
        } else {
            return source;
        }
    },
    render: function (template, options) {
        template = this.compile(template, options);
        return template(options);
    }
};

var routes = require('./routes');
var app = module.exports = express.createServer();

// Configuration

app.configure(function(){

    app.set('views', __dirname + '/views');
    app.set('view engine', 'mustache');
    app.set('view options', { layout: true });
    app.register('.html', tmpl);
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.methodOverride());
    app.use(express.session({'secret': 'secret'}));
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

// routes
app.get('/new/standards/:state?', routes.standards);
app.post('/search', routes.search);
app.get('/search', routes.search);
app.get('/screenshot/:docid', routes.screenshot);
app.get('/data/:docid', routes.data);
app.get('/data', routes.data);
app.get("/publishers", publishers.publishers);
app.get("/publisher/:pub", publishers.publisher);
// start

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.listen(5000);
});

app.configure('production', function(){
    app.use(express.errorHandler());
    app.listen(5000);
});
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
