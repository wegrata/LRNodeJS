from json import load
from couchdb import Database
db = Database("http://localhost:5985/standards")
children = load(open("D10003FC.json"))
data = {"_id": "english", "children": children, "title": "english", "description": "english"}
db.save(data)
children = load(open("D100011F.json"))
data = {"_id": "math", "children": children, "title": "math", "description": "math"}
db.save(data)
