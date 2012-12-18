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
var passport = require('passport');
var browserid = require('passport-browserid').Strategy;
var routes = require('./routes');
var users = require('./routes/users');
passport.serializeUser(users.serializeUser);
passport.deserializeUser(users.deserializeUser);
passport.use(new browserid({
    audience: 'http://192.168.190.128'
}, users.validateUser));
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
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

// routes
app.get('/',routes.index);
app.get('/standards/:category?', routes.standards);
app.get('/browser', routes.browser);
app.get('/visual', routes.visual);
app.post('/nodes/', routes.nodes);
app.get('/related', routes.related);
app.get('/resources', routes.resources);
app.get('/signup', users.signup);
app.post('/signup', users.signupHandler);
app.post('/auth', passport.authenticate('browserid', { failureRedirect: '/' }), users.auth);
app.post('/logout', users.logout);
app.post('/search', routes.search);
app.get('/search', routes.search);
app.get('/landing', routes.landing);
app.get('/sites', routes.sites);
app.get('/timeline', routes.timeline);
app.get('/find', routes.find);
app.get('/user', routes.user);
app.get('/screenshot/:docid', routes.screenshot);
app.get('/data/:docid', routes.data);
app.get('/data', routes.data);
app.get('/frame', function(req,res){

        res.writeHead(204, {});
        res.end();
	});
app.post('/main', function(req, res){
	console.log("user, ", req.user);

    switch (req.body.action.toLowerCase()){
        case "follow":
            users.follow(req.user, req.body.subject, function(err, response){
                if(err) {
                    console.error(err);
                    res.end();
                }else{
                    req.user.following.push(req.body.subject);
                    res.end(JSON.stringify({user: response, subject: req.body.subject}));
                }
            });
            break;

       case "bookmark":

       console.log(req.body);

            users.bookmark(req.user, req.body.subject, function(err, response){
                if(err) {
                    console.error(err);
                    res.end();
                }else{
					req.user.bookmarks = (req.user.bookmarks === undefined) ? [] : req.user.bookmarks;
                    req.user.bookmarks.push(req.body.subject);
                    res.end(JSON.stringify({user: response, subject: req.body.subject}));
                }
            });
            break;

       case "paradata":

       console.log(req.body);
       //return;
            users.paradata(req.user, req.body.subject, function(err, response){
                if(err) {
                    console.error(err);
                    res.end();
                }else{
					req.user.paradata = (req.user.paradata === undefined) ? [] : req.user.paradata;
                    req.user.paradata.push(req.body.subject);
                    res.end(JSON.stringify({user: response, subject: req.body.subject}));
                }
            });
            break;


    }
});
// start

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.listen(1337);
});

app.configure('production', function(){
    app.use(express.errorHandler());
    app.listen(80);
});
app.listen(80);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
