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
try{
var nr = require("newrelic");
}catch(ex){
    //ignore error if newrelic isn't installed
}
var numCPUs = 1 + (require('os').cpus().length * 2);
var express  = require('express');
var mustache = require('mustache');
var config   = require('config');
var routes = require('./routes');
var cluster = require('cluster');
var fs = require("fs");
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
app.get("/thumbnail/:docid", routes.thumbnail);
app.get('/data/:docid', routes.data);
app.get('/data', routes.data);
app.get("/publishers", publishers.publishers);
app.get("/publishers/:letter", publishers.filteredPublishers);
app.get("/publishers/view", function(req, res){
    res.render("publishers.html")
});
app.get("/publisher/:pub", publishers.publisher);
app.get("/publisher/:pub/view", function(req, res){
    var viewOptions = {
      locals: {
        pub: req.params.pub,
      }
    };    
    res.render("publisher.html", viewOptions)
});
// start
if(cluster.isMaster){
    var startingPort = 5000;
    for(var i=0; i < numCPUs; i++){
        cluster.fork({port: startingPort});
    }
}else {
    fs.readFile("english.stop", function(err, data){    
        app.settings.stopWords = data.toString().split('\n');
        console.log(app.settings.stopWords.length);
        app.use(express.errorHandler());
        app.listen(process.env.port);
        console.log("Express server listening on port %d in %s mode", process.env.port, app.settings.env);
    });
}
