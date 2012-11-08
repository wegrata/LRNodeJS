#!/bin/sh

#   Copyright 2012 Navigation North Learning Solutions LLC
#   Licensed under the Apache License, Version 2.0 (the "License");

# ------ 20 Jun 2012 ------ #
# Create Database
# Standards - stores hierarchical education data for imported standards
curl -X PUT http://admin:password@localhost:5984/standards
curl -X PUT http://admin:password@localhost:5984/users
# Create views
# TODO standard-grade-parent's map fn -> multiline format for readibility
curl -X PUT http://admin:password@localhost:5984/standards/_design/nodes --data '
{
  "_id":"_design/nodes",
  "language": "javascript",
  "views":
  {
    "categories": {
	"map": "function(doc) { if (doc.standard === true) emit(doc.categoryName, doc.id); }",
	"reduce": "function(keys, values, rereduce) { return values; }"
    },
    "standards": {
	"map": "function(doc) { if (doc.standard === true) emit([doc.categoryName, doc.id], doc._id); }"
    },
    "parent-grade": {
        "map": "function(doc) { if(doc.standard === true || doc.category === true) return; var grades = doc.dcterms_educationLevel; if(grades.forEach === undefined) grades = [grades]; grades.forEach(function(i,g) { var grade = grades[g].prefLabel; emit([doc.parent, grade], doc); }); }"
    }
  }
}'
curl -X PUT http://admin:password@localhost:5984/_desing/users -H "Content-Type:application/json" --data '
{
   "_id": "_design/users",
   "_rev": "4-bd136ed7cbef172f7f42b4b85a72d27b",
   "language": "javascript",
   "views": {
       "organizations": {
           "map": "function(doc) { if (doc.isOrginization === true) emit(doc.name, null); }"
       },
       "users": {
           "map": "function(doc) { if (doc.isOrginization === false) emit(doc.email, null); }"
       }
   }
}'