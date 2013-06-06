var couchdb = require('couchdb-api');
var underscore = require('underscore');
var server       = couchdb.srv('localhost', 5984, false, true);
var db           = server.db('lr-data');
var publisherView      = db.ddoc('publisher_view').view('publishers');
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


exports.publishers = function(req, res){
	publisherView.query({group: true}, function(err, results){
		if(err){
			writeNotFound(res);
		}else{
			writeSuccess(underscore.map(results.rows, function(item){
				return item.key;
			}), res);
		}
	});
}
exports.publisher = function(req, res){
	var pub = req.params.pub;
	publisherView.query({reduce: false, key: pub, include_docs: true}, function(err, results){
		if(err){
			writeNotFound(res);
		}else{
			writeSuccess(underscore.map(results.rows, function(item){
				var doc = item.doc;
				if(doc._attachments){
					delete doc._attachments;
				}
				return item.doc;
			}), res);
		}
	});	
}