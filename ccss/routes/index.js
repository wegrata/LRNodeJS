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
var https = require('https'),
    qs = require('qs');
var couchdb = require('couchdb-api');
var config  = require('config');
var r       = require('request');
var underscore = require('underscore');
var redis = require("redis");
var client = redis.createClient();
// couchdb db
var server       = couchdb.srv('localhost', 5984, false, true);
var standardsDb  = server.db('standards');
var usersDb      = server.db('users');
var db           = server.db('lr-data');
// views

var nodesView      = standardsDb.ddoc('nodes').view('parent-grade');
var categoriesView = standardsDb.ddoc('nodes').view('categories');
var standardsView  = standardsDb.ddoc('nodes').view('standards');
var jobTitleView  = usersDb.ddoc("users").view("jobTitle");
// route to display nodes hierarchically
//   set body.category + body.standard for standard's child nodes
//   OR body.parent for child nodes of parent
//   cookies.grade-filter determines grade of nodes to load
//     defaults to K/Kindergarten
exports.nodes = function( request, response, next ) {
    var category = request.body.category           || null;
    var standard = request.body.standard           || null;
    var parent   = request.body.parent             || null;
    var grade    = request.cookies['grade-filter'] || 'K';

    if ((!category && !standard && !parent) ||
    (category && !standard) ||
    (!category && standard)) {
    return next(new Error('Must provide cateogry + standard or parent'));
    }

    if (category) category = unescape(category);
    if (standard) standard = unescape(standard);
    if (parent)   parent   = unescape(parent);

    var nodesParams = {
    include_docs: true
    };

    var nodesFinished = function(err, result) {
    if (err) return next(err);

    var docs = result.rows.map( function(n) { return n.value; } );

    var viewOptions = {};
    viewOptions.layout = false;
    viewOptions.locals = {};
    viewOptions.locals.nodes = docs;

    response.render('nodes.html', viewOptions);
    };

    var standardsParams;

    if (standard) {
    standardsParams = {
        include_docs: true,
        startkey: [ category, standard ],
        endkey: [ category, standard ]
    };

    standardsView.query(standardsParams, function (err, result) {
        nodesParams.startkey = nodesParams.endkey = [ result.rows[0].value, grade ];
        nodesView.query(nodesParams, nodesFinished);
    });
    }
    else {
    nodesParams.startkey = nodesParams.endkey = [ parent, grade ];
    nodesView.query(nodesParams, nodesFinished);
    }
};

// route for displaying categorized standards
//   pass params.category to filter by category
exports.standards = function( request, response, next ) {
    var category = request.params.category || null; // optional

    var query = { group: true };

    if (category !== null) {
    query.startkey = category;
    query.endkey = category;
    }

    categoriesView.query(query, function(err, result) {
    if (err) return next(err);

    var viewOptions = {
        layout: false,
        locals: {
        categories: result.rows.map( function(n) {
            return { name: n.key, standards: n.value };
        })
        }
    };

    response.render('standards.html', viewOptions);
    });
};

// main route for browser UI
exports.browser = function( request, response, next ) {
    var query = { group: true };

    categoriesView.query(query, function(err, result) {
    if (err) return next(err);

    var viewOptions = {
        locals: {
        categories: result.rows.map( function(n) {
            return { name: n.key, standards: n.value };
        })
        }
    };

  viewOptions.layout = (request.query.ajax === undefined)? true : false;
    response.render('browser.html', viewOptions);
    });
};

exports.resources = function (request, response, next) {
  var requestOptions = {
    url: config.resourceService.url,
    qs: request.query
  };

  var external = r(requestOptions);

  request.pipe(external).pipe(response);
};

exports.index = function(request,response) {
    var opts = {};
    opts.locals = opts.locals || {};



   if (request.user)
       opts.locals.user = request.user;      
   else
       response.redirect('/landing');
    
     
     //For testing purporses.. may have to make this a global array..
     opts.locals.orgs = ['ADL 3D Repository','Agilix / BrainHoney','BCOE / CADRE','BetterLesson','California Dept of Ed',
           'Doing What Works','European Schoolnet','Florida\'s CPALMS','FREE','Library of Congress',
           'National Archives','NSDL','PBS LearningMedia','Shodor','Smithsonian Education'];
     if(request.user){
        opts.locals.orgs = underscore.filter(opts.locals.orgs, function(org){
          return !underscore.contains(request.user.following, org);
        });
        opts.locals.followed = underscore.uniq(request.user.following);
     }
     opts.locals.terms = ['adl','betterlesson','brokers of expertise','BetterLesson','brokers of expertise',
           'Doing What Works','EUN','cpalms','Federal Resources for Educational Excellence','Library of Congress',
           'National Archives','NSDL','PBS','Shodor','Smithsonian Education'];
    if (request.user && request.user.jobTitle || false){
      params = {
          include_docs: true,
          key: request.user.jobTitle
      };
      jobTitleView.query(params, function(err, result){
          opts.locals.sameOccupation = result.rows.map( function(n) {
                      return n.value;
                  });
          response.render('index.html', opts);
      });
    } else{
      response.render('index.html', opts);  
    }
};
exports.visual = function(request,response) {
  var viewOptions = {locals:{}};
  viewOptions.layout = (request.query.ajax === undefined)? true : false;
  viewOptions.locals.query = (request.query.query === undefined)? "" : request.query.query;

    response.render('visual.html', viewOptions);
};

exports.main = function(request, response){

  //I assume this is how we know whether or not a user is logged in
  if (request.session)
    resp.redirect('/index');

  else
    response.render('main.html');
};
exports.search = function(req, res) {
  var terms = "";
  var page = 0;
  var pageSize = 20;
  if (req.body.terms)
    terms = req.body.terms.toLowerCase().split(' ');
  else if(req.query.terms)
    terms = req.query.terms.toLowerCase().split(' ');
  if (req.body.page)
    page = req.body.page;
  else if(req.query.page)
    page = req.query.page;
  page = parseInt(page, 10) * pageSize;
  client.incr("session_id", function(err, data){
    var params = [data, terms.length];
    params = params.concat(terms);
    params.push(function(err, result){
      client.expire(data, 360, redis.print);
      client.zrevrange(data, page, page + pageSize, function(err, items){
        var getDisplayData = function(e, d){
          res.writeHead(200, {"Content-Type": "application/json"});
          res.end(JSON.stringify(underscore.map(d.rows, function(item){
            item.doc.hasScreenshot = item.doc._attachments !== undefined;
            delete item.doc._attachments;
            return item.doc;
          })));
        };
        if(items.length > 0){
          db.allDocs({include_docs: true}, items, getDisplayData);
        }else{
          res.writeHead(200, {"Content-Type": "application/json"});
          res.end(JSON.stringify([]));
        }

      });

    });
    client.zunionstore.apply(client, params);
  });
};

exports.find = function(request,response) {
  var opts = {};
    opts.locals = opts.locals || {};
  if (request.user)
      opts.locals.user = request.user;
  opts.locals.query = (request.query.query === undefined)? "" : request.query.query;

  response.render('find.html', opts);
};

exports.landing = function(request,response) {
  var viewOptions = {locals:{}};
  viewOptions.layout = (request.query.ajax === undefined)? true : false;
  viewOptions.locals.query = (request.query.query === undefined)? "" : request.query.query;
  viewOptions.locals.landing = true;

    response.render('landing.html', viewOptions);
};

exports.sites = function(request,response) {
     var opts = {};
    opts.locals = opts.locals || {};
    if (request.user)
      opts.locals.user = request.user;
     //For testing purporses.. may have to make this a global array..
     opts.locals = opts.locals || {};
     opts.locals.orgs = ['ADL 3D Repository','Agilix / BrainHoney','BCOE / CADRE','BetterLesson','California Dept of Ed',
           'Doing What Works','European Schoolnet','Florida\'s CPALMS','FREE','Library of Congress',
           'National Archives','NSDL','PBS LearningMedia','Shodor','Smithsonian Education'];
     if(request.user){
        opts.locals.orgs = underscore.filter(opts.locals.orgs, function(org){
          return !underscore.contains(request.user.following, org);
        });
        opts.locals.followed = underscore.uniq(request.user.following);
     }
     opts.locals.terms = ['adl','betterlesson','brokers of expertise','BetterLesson','brokers of expertise',
           'Doing What Works','EUN','cpalms','Federal Resources for Educational Excellence','Library of Congress',
           'National Archives','NSDL','PBS','Shodor','Smithsonian Education'];
    response.render('sites.html', opts);
};

exports.timeline = function(request,response) {
  var opts = {};
    opts.locals = opts.locals || {};
  if (request.user)
      opts.locals.user = request.user;
  opts.layout = (request.query.ajax === undefined)? true : false;
  opts.locals.query = (request.query.query === undefined)? "" : request.query.query;
  opts.locals.hide = {topMargin:true, footer: true};

    response.render('timeline.html', opts);
};

exports.screenshot = function(req, res){
  var doc_id = req.params.docid;
  var doc = db.doc(doc_id);
  doc.attachment('screenshot.jpeg').get(true, function(err, s){
    if(s){
      s.pipe(res, {end: true});
    }else{
      res.writeHead(404, {});
      res.end("<html><body><h1>Not Found</h1></body></html>");
    }
  });
};
exports.data = function(req, res){
  var doc_id = req.params.docid;
  var doc = db.doc(doc_id);
  doc.get(function(err, s){
    if (s){
      res.writeHead(200, {"Content-Type":"application/json"});
      delete s._attachments;
      res.end(JSON.stringify(s));
    }else{
      res.writeHead(404, {});
      res.end(JSON.stringify({error:true}));
    }
  });
}
