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

// couchdb db
var server       = couchdb.srv('localhost', 5984, false, true);
var standardsDb  = server.db('standards');

// views
var nodesView      = standardsDb.ddoc('nodes').view('parent-grade');
var categoriesView = standardsDb.ddoc('nodes').view('categories');
var standardsView  = standardsDb.ddoc('nodes').view('standards');

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
     //For testing purporses.. may have to make this a global array..
     opts.locals.orgs = ['ADL 3D Repository','Agilix / BrainHoney','BCOE / CADRE','BetterLesson','California Dept of Ed',
           'Doing What Works','European Schoolnet','Florida\'s CPALMS','FREE','Library of Congress',
           'National Archives','NSDL','PBS LearningMedia','Shodor','Smithsonian Education'];
     opts.locals.terms = ['adl','betterlesson','brokers of expertise','BetterLesson','brokers of expertise',
           'Doing What Works','EUN','cpalms','Federal Resources for Educational Excellence','Library of Congress',
           'National Archives','NSDL','PBS','Shodor','Smithsonian Education'];

    response.render('index.html', opts);
};
exports.visual = function(request,response) {
  var viewOptions = {};
  viewOptions.layout = (request.query.ajax === undefined)? true : false;
    response.render('visual.html', viewOptions);
};

exports.main = function(request, response){

  //I assume this is how we know whether or not a user is logged in
  if (request.session)
    resp.redirect('/index');

  else
    response.render('main.html');
};