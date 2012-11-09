var passport = require('passport');
var couchdb  = require('couchdb-api');
// couchdb db
var server         = couchdb.srv('localhost', 5984, false, true);
var usersDb        = server.db('users');
// views
var designDoc      = usersDb.ddoc('users');
var users          = designDoc.view('users');
var organizations  = designDoc.view('organizations');

exports.serializeUser = function(user, done) {
  done(null, user);
};
exports.deserializeUser = function(email, done) {
  done(null, email);
};
var createUser = function(email, done){
    var doc = usersDb.doc();
    var data = {
        email: email,
        isOrginization: false,
        following: []
    };
    doc.body = data;
    doc.save(function(err, response){
        if(err){
            console.log(err);
        }else{
            done(null, doc.body);
        }
    });
};
exports.follow = function(currentUser, targetUser, callback){
    var currentUserDoc = usersDb.doc(currentUser._id);
    currentUserDoc.body.follows.push(targetUser);
    doc.save(callback);
};
function getUser(email, success, failure){
    var userParams = {
        include_docs: true,
        key: email
    };
    users.query(userParams, function(err, result){
        if(err){
            failure(err);
        }else{
            success(result);
        }
    });
}
exports.validateUser = function(email, done){
    var successHandler = function(result){
            if (result.total_rows === 0){
                createUser(email, done);
            }else{
                done(null, result.rows[0].doc);
            }
    };
    var failureHandler = function(err){
            console.error(err);
            if(err.error == 'not_found'){
                createUser(email, done);
            }
    };
    getUser(email,successHandler,failureHandler);
};
exports.logout = function(req, res){
    req.logout();
    res.redirect('/');
};
exports.auth = function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
};