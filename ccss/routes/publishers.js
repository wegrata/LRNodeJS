var couchdb = require('couchdb-api');
var underscore = require('underscore');
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
exports.publishers = function(req, res){
	var page = req.query.page || 0;
	var view = req.query.gov ? govPublisherView : publisherView;
	view.query({group: true, stale: "update_after", limit: pageSize, skip: page * pageSize,  inclusive_end: true}, function(err, results){
		if(err){
			console.log(err);
			writeNotFound(res);
		}else{
			writeSuccess(underscore.map(results.rows, function(item){
				return item.value;
			}), res);
		}
	});
}
exports.filteredPublishers = function(req, res){	
	var page = req.query.page || 0;
	var key = req.params.letter;
	alphabetView.query({group: true, stale: "update_after", key: key, limit: pageSize, skip: page * pageSize,  inclusive_end: true}, function(err, results){
		console.log(key);
		if(err){
			console.log(err);
			writeNotFound(res);
		}else{
			writeSuccess(results.rows[0].value, res);
		}
	});
}
exports.publisher = function(req, res){
	var pub = req.params.pub;
	var page = req.query.page || 0;
	publisherView.query({reduce: false, key: pub.toLowerCase(), include_docs: true, stale: "update_after", limit: pageSize, skip: page * pageSize,  inclusive_end: true}, function(err, results){
		if(err){
			writeNotFound(res);
		}else{
			writeSuccess(underscore.map(results.rows, function(item){
				var doc = item.doc;
				if(doc._attachments){
					delete doc._attachments;
					doc.hasScreenshot = true;
				}else{
					doc.hasScreenshot = false;
				}
				return item.doc;
			}), res);
		}
	});	
}
