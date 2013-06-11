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
client.select(0, function(){});
// couchdb db
var server       = couchdb.srv('localhost', 5984, false, true);
var standardsDb  = server.db('standards');
var usersDb      = server.db('users');
var db           = server.db('lr-data');
// views
var pageSize = 25;
var childrenView      = standardsDb.ddoc('standards').view('children');
var getDisplayData = function(res, count){
  return function(e, d){
  res.writeHead(200, {"Content-Type": "application/json",
                      "Access-Control-Allow-Origin": "*",
                      "Access-Control-Allow-Methods": "GET",
                      "Access-Control-Allow-Headers": "*"  });
  var filteredList = underscore.filter(d.rows, function(item) {
	return !item.error && item.doc.url;
  });
  var result = underscore.map(filteredList, function(item){
    if(!item.error){
      item.doc.hasScreenshot = item.doc._attachments !== undefined;
      delete item.doc._attachments;
      return item.doc;
    }
  });
  if(count){
    var resultList = result;
    result = {
      count: count,
      data: resultList
    };
  }
  res.end(JSON.stringify(result));
  }; 
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


exports.resources = function (request, response, next) {
  var requestOptions = {
    url: config.resourceService.url,
    qs: request.query
  };

  var external = r(requestOptions);

  request.pipe(external).pipe(response);
};
function getSearchResults(page, terms, filter, res){
  var data = terms.join("") + "-index";
  var params = [data, terms.length];
  params = params.concat(terms);
  function returnResults(target){
    client.zcard(target, function(err, result){
      client.zrevrange(target, page, page + pageSize, function(err, items){
        if(items.length > 0){
          var dis = getDisplayData(res, result);
          db.allDocs({include_docs: true}, items, dis);
        }else{
          res.writeHead(200, {"Content-Type": "application/json"});
          res.end(JSON.stringify({data: [], count: 0}));
        }
      });      
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
      client.zinterstore.apply(client, filterParms);
    }else{
      returnResults(data);
    }

  });
  client.zunionstore.apply(client, params);
}
exports.search = function(req, res) {
  function getTerms(termsString){
    var terms = [];
    terms = termsString.toLowerCase().split(' ');
    // if(terms.length > 1)
    //   terms.push(termsString.toLowerCase());
    return terms.sort();
  }
  var terms = [];
  var filter = null;
  var page = 0;
  var rawTerm = null;
  if (req.body.terms){
    rawTerm = req.body.terms;
    terms = getTerms(req.body.terms);
  }else if(req.query.terms){
    rawTerm = req.query.terms;
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
  childrenView.query({key: rawTerm}, function(err, result){
    if(!err && result.rows.length > 0){
      terms = underscore.map(result.rows, function(item){
        return item.value;
      });
    }
    console.log(terms);
    getSearchResults(page, terms, filter, res);    
  });
  
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
    var dis = getDisplayData(res);
    db.allDocs({include_docs: true}, keys, dis);
  }
};
