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
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var path = require('path');
var url = require("url");
var Tokenizer = require("sentence-tokenizer");
var qs = require('qs');
var couchdb = require('couchdb-api');
var config  = require('config');
var http = require("http");
//var agent = new http.Agent({maxSSockets: 3 });
var r       = require('request');
var underscore = require('underscore');
var redis = require("redis");
var client = redis.createClient(6379, process.env.REDIS || "localhost", {});
client.on("error", function(err){
  console.error(err);
});
client.on("end", function(){
  console.log("Client Closed");
});
var stemmer = require("porter-stemmer").stemmer;
client.select(1, function(){});
// couchdb db
var server       = couchdb.srv(process.env.COUCHDB || 'localhost', 5984, false, true);
var standardsDb  = server.db('standards');
var usersDb      = server.db('users');
var db           = server.db('lr-data');
var govView = db.ddoc("gov").view("gov-list");
// views
var pageSize = 25;
var childrenView      = standardsDb.ddoc('standards').view('children');
exports.standards = function(request, response, next) {
  var state = request.params.state || null; // optional
  function writeSuccess(doc){
      response.header("Access-Control-Allow-Origin", "*");
      response.header("Access-Control-Allow-Methods", "GET");
      response.header("Access-Control-Allow-Headers", "*");
      response.header("Content-Type", "application/json");
      response.end(JSON.stringify(doc), {end: true});
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
    serveFromCouchdb(response, "application/json", doc.url);
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

function executeQuery(keys, page, callback, filter){
    var command = []
    var offset = 10;
    command.push("local inter_name = 'inter-' .. table.concat(KEYS, '-') \
                  local index_name = 'index-' .. table.concat(KEYS, '-') \
                  local result = {} \
                  redis.call('zinterstore', inter_name, #KEYS, unpack(KEYS)) \
                  table.insert(KEYS, inter_name) \
                  redis.call('zunionstore', index_name, #KEYS, unpack(KEYS)) \
                  result[1] = redis.call('zcard', index_name) \
                  if ARGV[3] then \
                      redis.call('zinterstore', 'filtered-' .. index_name, 2, ARGV[3], index_name) \
                      index_name = 'filtered-' .. index_name \
                  end \
                  result[2] = redis.call('zrevrange', index_name, ARGV[1], ARGV[2]) \
                  redis.call('expire', inter_name, 360) \
                  redis.call('expire', index_name, 360) \
                  return result \
                ");
    command.push(keys.length);
    for (var i in keys){
        command.push(keys[i]);
    }
    command.push(page * offset);
    command.push(offset)
    if (filter){
        command.push(filter);
    }
    client.eval(command, callback);
}
function sendSearchResults(response, gov, items, count){
    var urlParts = url.parse(db.url);
    var opts = {
        host: urlParts.hostname,
        port: urlParts.port,
        headers: {
            "Content-Type": "application/json"
        },
        protocol: urlParts.protocol,        
        method: "POST"
    };
    if (gov){
        opts.path = urlParts.path + '/_design/gov/_list/display/gov-list?include_docs=true&c=' + count;
    }else{
        opts.path = urlParts.path + '/_design/gov/_list/display/all?include_docs=true&c=' + count;
    }    
    var data = JSON.stringify({
            stale: "update_after",
            keys: items
    });
    response.writeHead(200, {"Content-Type": "application/json",
                             "Access-Control-Allow-Origin": "*",
                             "Access-Control-Allow-Methods": "GET",
                             "Access-Control-Allow-Headers": "*"  });
    var req = http.request(opts, function(res) {
        res.pipe(response, {end: true});
    });
    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });
    req.write(data);
    req.end();
}

exports.search = function(req, res) {
  function getTerms(termsString){
    var tok = new Tokenizer("chunk");    
    tok.setEntry(termsString.toLowerCase());
    var terms = [];
    try{
      var sentences = tok.getSentences();
      terms = tok.getTokens();
    }catch(ex){
      console.error(ex);
    }
    var cleanedResults = underscore.filter(terms, function(term){
      return req.app.settings.stopWords.indexOf(term) == -1;
    });
    return cleanedResults;
  }  
  var terms = [];
  var filter = null;
  var page = 0;
  var rawTerm = null;
  var gov = false;
  if (req.body.terms){
    rawTerm = req.body.terms;
    terms = getTerms(req.body.terms);
  }else if(req.query.terms){
    rawTerm = req.query.terms;
    terms = getTerms(req.query.terms);
  }
  if (req.body.gov){
    gov = req.body.gov;
  }else if(req.query.gov){
    gov = req.query.gov;
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
      terms.push(rawTerm);
    }
    if(terms.length <= 0){
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET");
      res.header("Access-Control-Allow-Headers", "*");
      res.header("Content-Type", "application/json");  
      res.end("[]");
    }else{
        var f = null;
        if (filter && filter.length > 0){
            f = filter[0];
        }
        executeQuery(terms, page, function(e, result){
            sendSearchResults(res, gov, result[1], result[0]);
        }, f);
    }
  });
  
};
function serveFromCouchdb(response, contentType, couchUrl, fileName){
  console.log(couchUrl);
  var urlParts = url.parse(couchUrl);
  var opts = {
    host: urlParts.hostname,
    port: urlParts.port,
    path: urlParts.path,
    agent: false,
    headers: {
      "Content-Type": "application/json",
      "Connetion": "close"
    }
  }
  http.get(opts, function(res){     
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Methods", "GET");
    response.header("Access-Control-Allow-Headers", "*");
    response.header("Content-Type", contentType);      
    if(fileName){
        var s = fs.createWriteStream(fileName);
        res.pipe(s, {end: true});   
        s.on("finish", function(){
            fs.createReadStream(fileName)
              .pipe(response);
        });
    }else{   
        res.pipe(response, {end: true});
    }
  });


}
function serveFileFromCache(doc_id, rootDir, remoteFileName, res){
  var contentType = "image/jpeg";
  if (!fs.existsSync(rootDir)){
      fs.mkdirSync(rootDir);
  }
  var filePath = path.join(rootDir, doc_id);
  if(fs.existsSync(filePath) && process.env.FRONTEND){
      console.log("got here");
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET");
      res.header("Access-Control-Allow-Headers", "*");
      res.header("Content-Type", contentType); 
      fs.createReadStream(filePath).pipe(res, {end: true});
  }else{
      var doc = db.doc(doc_id);
      serveFromCouchdb(res, contentType, doc.attachment(remoteFileName).url, filePath)
  }
}
exports.screenshot = function(req, res){
  var doc_id = req.params.docid;
  var rootDir = "./screenshot";
  serveFileFromCache(doc_id, rootDir, "screenshot.jpeg", res);

};
exports.thumbnail = function(req, res){ 
  try{ 
    var doc_id = req.params.docid;
    var rootDir = "./thumbnail";
    serveFileFromCache(doc_id, rootDir, "thumbnail.jpeg", res);
  }catch(ex){
    console.error(ex);
    res.end();
  }
};
exports.data = function(req, res){
  if(!req.query.keys){
    var doc_id = req.params.docid;
    var doc = db.doc(doc_id);
    doc.get(function(err, s){
      if (s){
        if (s._attachments)
          s.hasScreenshot = true;
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
    sendSearchResults(res, false, keys, keys.length);
  }
};
