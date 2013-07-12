var couchdb = require('couchdb-api');
var http = require('http');
var querystring = require('querystring');
var underscore = require('underscore');
var url = require('url');
var server       = couchdb.srv(process.env.COUCHDB || 'localhost', 5984, false, true);
var db           = server.db('lr-data');
var publisherView      = db.ddoc('publisher_view').view('publishers');
var govPublisherView      = db.ddoc('publisher_view').view('gov-publishers');
var alphabetView = db.ddoc("publisher_view").view("firstLetter");
function writeSuccess(doc, response){
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Methods", "GET");
  response.header("Access-Control-Allow-Headers", "*");
  response.header("Content-Type", "application/json");
  response.end(JSON.stringify(doc));
}
function writeNotFound(response){
response.writeHead(404, {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "text/plain"
});
response.end("Not Found");
}

var pageSize = 25;
function getView(gov){
    if (gov){
        return '/_design/publisher_view/_list/root/gov-publishers';
    }else{
        return '/_design/publisher_view/_list/root/publishers';
    }    	
}
function serveView(response, view, key, page, includeDocs){
    var urlParts = url.parse(db.url);
    var opts = {
        host: urlParts.hostname,
        port: urlParts.port,
        headers: {
            "Content-Type": "application/json"
        },
        protocol: urlParts.protocol,        
        method: key ? "POST": "GET"
    };
    opts.path = urlParts.path + view;
    var data = {
            stale: "update_after",
            skip: page * pageSize,
            limit: pageSize,
            group: true,
            inclusive_end: true,
    };

    if (includeDocs){
      data.include_docs = true;
      data.reduce = false;
      data.group = false;
    }    
    opts.path = (opts.path + '?' + querystring.stringify(data));
    response.writeHead(200, {"Content-Type": "application/json",
                             "Access-Control-Allow-Origin": "*",
                             "Access-Control-Allow-Methods": "GET",
                             "Access-Control-Allow-Headers": "*"  });
    if(key){
      data.method = "POST";
    }
    var req = http.request(opts, function(res) {
        res.pipe(response, {end: true});
    });
    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });
    if (key){      
      req.write(JSON.stringify({key: key}));
    }        
    req.end();
}
exports.publishers = function(req, res){
	var page = req.query.page || 0;
	serveView(res, getView(req.query.gov), null, page);
}
exports.filteredPublishers = function(req, res){	
	var page = req.query.page || 0;
	var key = req.params.letter;
	serveView(res, "/_design/publisher_view/_list/child/firstLetter", key, page);
}
exports.publisher = function(req, res){
	var pub = req.params.pub;
	var page = req.query.page || 0;
  serveView(res, '/_design/publisher_view/_list/root/publishers', pub.toLowerCase(), page, true);
}
