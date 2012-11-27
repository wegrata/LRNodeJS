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
    currentUserDoc.get(function(err, doc){
        doc.following.push(targetUser);
        currentUserDoc.body = doc;
        currentUserDoc.save(callback);
    });
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
            if (result.rows.length === 0){
                createUser(email, done);
            }else{
                done(null, result.rows[0].doc);
            }
    };
    var failureHandler = function(err){
            if(err.error == 'not_found'){
                createUser(email, done);
            }
    };
    getUser(email,successHandler,failureHandler);
};
exports.logout = function(req, res){
    req.logout();
    req.session.destroy();
    res.redirect('/');
};
exports.auth = function(req, res) {
    // Successful authentication, redirect home.
    if(req.user.jobTitle)
        res.redirect('/');
    else
        res.redirect('/signup');
};

exports.signup = function(request, response){
    var opts = {};
    opts.locals = opts.locals || {};
    if (request.user)
      opts.locals.user = request.user;
    response.render('signup.html', opts);
};
exports.signupHandler = function(req, res){
    var currentUserDoc = usersDb.doc(req.user._id);
    currentUserDoc.get(function(err, doc){
        doc.fullName = req.body.fullName;
        doc.jobTitle = req.body.jobTitle;
        doc.education = req.body.education;
        currentUserDoc.body = doc;
        currentUserDoc.save(function(doc, error){
            req.user.fullName = req.body.fullName;
            req.user.jobTitle = req.body.jobTitle;
            req.user.education = req.body.education;
            res.redirect('/');
        });
    });

};
