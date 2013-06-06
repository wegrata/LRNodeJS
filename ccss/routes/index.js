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
client.select(1, function(){});
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
var getDisplayData = function(res){
  return function(e, d){
  res.writeHead(200, {"Content-Type": "application/json",
                      "Access-Control-Allow-Origin": "*",
                      "Access-Control-Allow-Methods": "GET",
                      "Access-Control-Allow-Headers": "*"  });
  var filteredList = underscore.filter(d.rows, function(item) {
	return !item.error && item.doc.url;
  });
  console.log(d.rows);
  console.log(filteredList);
  res.end(JSON.stringify(underscore.map(filteredList, function(item){
    if(!item.error){
      item.doc.hasScreenshot = item.doc._attachments !== undefined;
      delete item.doc._attachments;
      return item.doc;
    }
  })));
};
};
// route to display nodes hierarchically
//   set body.category + body.standard for standard's child nodes
//   OR body.parent for child nodes of parent
//   cookies.grade-filter determines grade of nodes to load
//     defaults to K/Kindergarten
exports.nodes = function( request, response, next ) {
  var category = request.body.category || request.query.category || null;
  var standard = request.body.standard || request.query.standard || null;
  var parent   = request.body.parent || request.query.parent || null;
  var grade    = request.body.grade || request.query.grade || request.cookies['grade-filter'];

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
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Methods", "GET");
    response.header("Access-Control-Allow-Headers", "*");
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

exports.standards = function(request, response, next) {
  var state = request.params.state || null; // optional
  function writeSuccess(doc){
      response.header("Access-Control-Allow-Origin", "*");
      response.header("Access-Control-Allow-Methods", "GET");
      response.header("Access-Control-Allow-Headers", "*");
      response.header("Content-Type", "application/json");
      response.end(JSON.stringify(doc));
  }
  function writeNotFound(){
    response.writeHead(404, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "text/plain"
    });
    response.end("Not Found");
  }
  if(state){
    var doc = standardsDb.doc(state);
    doc.get(function(err, result){
      if(err){
        writeNotFound();
      }else{
        writeSuccess(result);
      }
    });
  }else{
    standardsDb.allDocs({}, function(err, result){
      if (err){
        writeNotFound();
      }else{
        var states = underscore.map(result.rows, function(row){
          return row.key;
        });
        writeSuccess(states);
      }
    });
  }
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
    viewOptions.locals.ajax = (request.query.ajax === undefined)? false : true;
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Methods", "GET");
    response.header("Access-Control-Allow-Headers", "*");
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

exports.search = function(req, res) {
  function getTerms(termsString){
    var terms = [];
    terms = termsString.toLowerCase().split(' ');
    if(terms.length > 1)
      terms.push(termsString.toLowerCase());
    return terms.sort();
  }
  var terms = [];
  var filter = null;
  var page = 0;
  var pageSize = 20;
  if (req.body.terms){
    terms = getTerms(req.body.terms);
  }else if(req.query.terms){
    terms = getTerms(req.query.terms);
  }
  if(req.body.filter)
    filter = req.body.filter.toLowerCase().split(';');
  else if(req.query.filter)
    filter = req.query.filter.toLowerCase().split(';');
  if (req.body.page)
    page = req.body.page;
  else if(req.query.page)
    page = req.query.page;
  page = parseInt(page, 10) * pageSize;
  var data = terms.join("") + "-index";
  var params = [data, terms.length];
  params = params.concat(terms);
  function returnResults(target){
    client.zrevrange(target, page, page + pageSize, function(err, items){
      if(items.length > 0){
        var dis = getDisplayData(res);
        db.allDocs({include_docs: true}, items, dis);
      }else{
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify([]));
      }

    });
  }
  params.push(function(err, result){
    client.expire(data, 360, redis.print);
    if(filter){
      var outid = data+filter.join("");
      var filterParms = [outid, filter.length + 1];
      filterParms = filterParms.concat(filter);
      filterParms.push(data);
      filterParms.push(function(err, result){
        if(err){
          res.writeHead(500);
          res.end();
        }else{
          returnResults(outid);
        }
      });
      console.log(filterParms);
      client.zinterstore.apply(client, filterParms);
    }else{
      returnResults(data);
    }

  });
  client.zunionstore.apply(client, params);
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
  if(!req.query.keys){
    var doc_id = req.params.docid;
    var doc = db.doc(doc_id);
    doc.get(function(err, s){
      if (s){
        delete s._attachments;
  res.writeHead(200, {"Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET",
                            "Access-Control-Allow-Headers": "*"  });
        res.end(JSON.stringify(s));
      }else{
        res.writeHead(404, {});
        res.end(JSON.stringify({error:true}));
      }
    });
  }else{
    var keys = JSON.parse(req.query.keys);
    console.log(keys);
    var dis = getDisplayData(res);
    db.allDocs({include_docs: true}, keys, dis);
  }
};
