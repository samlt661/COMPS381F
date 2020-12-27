const express = require("express");
const app = express();
const session = require('cookie-session');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const fs = require('fs');
const formidable = require('express-formidable');
const mongourl = '';  // MongoDB Atlas Connection URL
const client = new MongoClient(mongourl);
const dbName = 'project';
const SECRETKEY = "COMPS381F";

app.set('view engine', 'ejs');
app.use(session({
	name: "session",
    keys: [SECRETKEY],
    maxAge : 1*60*60*1000
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(formidable());


const findAll = (db,collection,criteria,callback)=>{
    console.log(`Finding DB: ${collection}`);
    let cursor = db.collection(collection).find(criteria);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        callback(docs);
    }); 
}
const insertDocument = (db,collection,insertDoc,callback)=>{
    console.log(`Inserting DB: ${collection}`);
    db.collection(collection).insertOne(insertDoc,(err,results)=>{
        assert.equal(null,err);
        console.log("Inserted a Document");  
        callback(results);
    });
}
const updateDocument = (db,collection,criteria,updateDoc,callback)=>{
    console.log(`Updating DB: ${collection}`);
    db.collection(collection).updateOne(criteria,
        {$set : updateDoc},(err,results)=>{
        assert.equal(null,err);
        console.log("Updated a Document");  
        callback(results);
    });
}
const deleteDocument = (db,collection,criteria,callback)=>{
    console.log(`Updating DB: ${collection}`);
    db.collection(collection).deleteOne(criteria,
        (err,results)=>{
        assert.equal(null,err);
        console.log("Deleted a Document");  
        callback(results);
    });
}
//Redirecting User to /login
app.get("/",(req,res)=>{
    res.redirect("/login")
});
//Show Login Page
app.get("/login",(req,res)=>{
    res.status(200).render("login",{isShow: "d-none",errorMsg:""});
    console.log(`Login Page(GET)`);
});
//Handle Logout 
app.get("/logout",(req,res)=>{
    console.log(`Logout Page(GET)`);
    req.session = null;
    res.redirect("/login");
});
//Show Register Page
app.get("/register",(req,res)=>{
    console.log(`Register Page (GET)`);
    res.status(200).render("register",{isShow: "d-none",errorMsg:""});
    
})
app.get("/apilanding",(req,res)=>{
    console.log(`API Page (GET)`);
    res.status(200).render("apilanding",{isShow: "d-none",errorMsg:""});
    
})
//Handle Register 
app.post('/register', (req,res) => {
    console.log(`Processing Register (POST)`);
    let username = req.fields.username;
    let password = req.fields.password;
    let confirmpassword = req.fields.confirmpassword;

    if(password!=confirmpassword){
        res.status(200).render("register",{
            isShow: "d-block",
            errorMsg:"Please Confirm Your Password Again"
        });
    }else{
        client.connect((err)=>{
            assert.equal(null,err);
            const db = client.db(dbName);
            let dbDoc = {"username" : username};
            findAll(db,"user",dbDoc,(results)=>{
                console.log(`Connection Closed`);

                if(results.length == 0){
                    let dbDoc = {
                        "username" : username,
                        "password" : password
                    };
                    client.connect((err)=>{
                        assert.equal(null,err);
                        const db = client.db(dbName);
                        insertDocument(db,"user",dbDoc,(results)=>{
                            console.log(`Connection Closed`);
                            
                            res.status(200).render("login",{
                                isShow: "d-block",
                                errorMsg: "Account Created"
                            });
                        });
                    });
                }else{
                    res.status(200).render("register",{
                        isShow: "d-block",
                        errorMsg:"The username already been taken"
                    });
                }
            });
        });
    }
});
//Handle Login 
app.post('/login', (req,res) => {
    console.log(`Processing Login (POST)`);
    let username = req.fields.username;
    let password = req.fields.password;
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        let dbDoc = {"username" : username, "password": password};
        findAll(db,"user",dbDoc,(results)=>{
            console.log(`Connection Closed`);

            console.log(`${results.length}`);
            if(results.length == 1){
                
                req.session.authenticated = true;
                req.session.username = username;
                res.redirect('/readDB');
            }else{
                res.status(200).render("login",{
                    isShow: "d-block",
                    errorMsg:"Username or password are incorrect"
                });
            }
        });
    });

	
});
//Show All DB Documents by Name, Borough or Cuisine
app.get("/readDB",(req,res)=>{
    console.log(`Reading All DB (GET), /readDB`);
        if(!req.session.authenticated){
            res.redirect("/");
        }
        let dbViewCol = "";
        if(req.query.t == null){
            dbViewCol = "Name";
        }else{
            dbViewCol = req.query.t;
        }
        let cursor = null;
        client.connect((err)=>{
            assert.equal(null,err);
            const db = client.db(dbName);
            findAll(db,"restaurant",{},(results)=>{
                console.log(`Connection Closed`);
                let countRows = 0;
                for(var r of results){
                    if(r[dbViewCol].length != 0){
                        countRows++;
                    }
                }
                res.status(200).render("readDB",
                    {userInfo:req.session.username,
                    dbDocs: results,
                    dbCol : dbViewCol,
                    totalCol :countRows
                    });
            });
        });
});
//Show a DB Document detail
app.get("/showDetails",(req,res)=>{
    console.log(`Showing Details of ${req.query._id} (GET), /showDetails`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        let DOCID = {};
        DOCID['_id'] = ObjectID(req.query._id);
        findAll(db,"restaurant",DOCID,(results)=>{
            console.log(`Connection Closed`);
            res.status(200).render("showDetails",{
                userInfo:req.session.username,
                dbDocs: results,
                isShow : "primary d-block",
                errorMsg : "Restaurant Details Listed Below"
            });
        });
    });
});
//GET the Add Restaurant Form
app.get("/addRestaurant",(req,res)=>{
    console.log(`Add Document Page (GET), /addRestaurant`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    res.status(200).render("addRestaurant",{
        userInfo:req.session.username
    });
});
//Add a new restaurant to mongodb
app.post('/addRestaurant', (req,res) => {
    console.log(`Add Document Page (POST), /addRestaurant`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    let dbObject = {};
    let photo = null;
    let photoMime = null;

    dbObject = {
        "Name" : req.fields.name,
        "Borough" : req.fields.borough,
        "Cuisine" : req.fields.cuisine,
        "Photo" : null,
        "PhotoMimeType" : null,
        "Address" :{
            "Street" : req.fields.street,
            "Building" : req.fields.building,
            "Zipcode": req.fields.zipcode,
            "Coords" : [req.fields.gpsLon,req.fields.gpsLat]
        },
        "Grades" : [],
        "Owner" : req.fields.owner
    }
    if (req.files.imageToUpload.size >0) {
    console.log(`Insert With Image`);
            fs.readFile(req.files.imageToUpload.path, (err,data) => {
                assert.equal(err,null);
                photo = new Buffer.from(data).toString('base64');
                photoMime = req.files.imageToUpload.type;
                dbObject.Photo = photo;
                dbObject.PhotoMimeType = photoMime;
            });
    } else {
        console.log(`Insert Without Image`);
    }
    client.connect((err)=>{
            assert.equal(null,err);
            const db = client.db(dbName);
            insertDocument(db,"restaurant",dbObject,(results)=>{
                console.log(`Connection Closed`);
                res.status(200).render("addedRestaurant",{
                    userInfo:req.session.username,
                    dbDocs: results.ops,
                    isShow : "d-block",
                    errorMsg : "Restaurant Added Successfully"

                });
            });
        });
});
//GET the Rate Restaurant Form       
app.get("/rateRestaurant",(req,res)=>{
    console.log(`Rate Document Page (GET), /rateRestaurant`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        let DOCID = {};
        DOCID['_id'] = ObjectID(req.query._id);
        findAll(db,"restaurant",DOCID,(results)=>{
            console.log(`Connection Closed`);
            for(var i=0;i<results[0].Grades.length;i++){
                if(results[0].Grades[i].Username == req.session.username){
                    res.redirect("/showError?t=ar&_id="+req.query._id);
                }
            }
            res.status(200).render("rateRestaurant",{
                userInfo:req.session.username,
                dbDocs: results,
                isShow : "primary d-block",
                errorMsg : "Rate Restaurant Here"
            });
        });
    });
});
//Rate a new restaurant at mongodb
app.post('/rateRestaurant', (req,res) => {
    console.log(`Rate Document Page (POST), /rateRestaurant`);
    if(!req.session.authenticated){
        res.redirect("/");
    }

        client.connect((err)=>{
            assert.equal(null,err);
            const db = client.db(dbName);
            let DOCID = {};
            DOCID['_id'] = ObjectID(req.fields._id);
            findAll(db,"restaurant",DOCID,(results)=>{
                console.log(`Connection Closed`);
                let dbObject = results[0];
                let gradesArray = dbObject.Grades;
                let timestamp = new Date();
                if(req.fields.rate == "default"){
                    let dbArray = [];
                    dbObject.Grades = results[0].Grades;
                    dbArray[0] = dbObject;
                    res.status(200).render("rateRestaurant",{
                        userInfo:req.session.username,
                        dbDocs: dbArray,
                        isShow : "danger d-block",
                        errorMsg : "Please Input Score"
                    });
                }else{
                    gradesArray[gradesArray.length] = {
                        "Username" : req.session.username,
                        "Rating" : req.fields.rate,
                        "Time" : timestamp.toString().substring(0,timestamp.toString().indexOf("GMT"))};
                    dbObject.Grades = gradesArray;
                    client.connect((err)=>{
                        assert.equal(null,err);
                        const db = client.db(dbName);
                        updateDocument(db,"restaurant",DOCID,dbObject,(results)=>{
                            console.log(`Connection Closed`);
                            let dbArray = [];
                            dbArray[0] = dbObject;
                            //res.redirect("/showDetails?_id="+req.fields._id);
                            res.status(200).render("showDetails",{
                                userInfo:req.session.username,
                                dbDocs: dbArray,
                                isShow : "success d-block",
                                errorMsg : "Successfully Rated Restaurant"
                            });
                        });
                    });
                }
            });
        });
});
//GET the Modify Restaurant Form
app.get("/modifyRestaurant",(req,res)=>{
    console.log(`Modify Document Page (GET), /modifyRestaurant`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    console.log(`Modifing ${req.query._id}`);
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        let DOCID = {};
        DOCID['_id'] = ObjectID(req.query._id);
        findAll(db,"restaurant",DOCID,(results)=>{
            console.log(`Connection Closed`);
            console.log(`${results[0].Owner} ${req.session.username}`)
            if(results[0].Owner == req.session.username){
                res.status(200).render("modifyRestaurant",{
                    userInfo:req.session.username,
                    dbDocs: results,
                    isShow : "primary d-block",
                    errorMsg : "Modify "+results[0].Name+" Info Here"
                });
            }else{
                res.redirect("/showError?t=nam&_id="+req.query._id);
            }
        });
    });
});
//Update a new restaurant at mongodb
app.post('/modifyRestaurant', (req,res) => {
    console.log(`Modify Document Page (POST), /modifyRestaurant`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
        client.connect((err)=>{
            assert.equal(null,err);
            const db = client.db(dbName);
            let DOCID = {};
            DOCID['_id'] = ObjectID(req.fields._id);
            findAll(db,"restaurant",DOCID,(results)=>{
                console.log(`Connection Closed`);
                let dbObject = {};
                dbObject = results[0];
                let gradesArray = dbObject.Grades;
                let photo = null;
                let photoMime = null;
                dbObject = {
                    "Name" : req.fields.name,
                    "Borough" : req.fields.borough,
                    "Cuisine" : req.fields.cuisine,
                    "Photo" : null,
                    "PhotoMimeType" : null,
                    "Address" :{
                        "Street" : req.fields.street,
                        "Building" : req.fields.building,
                        "Zipcode": req.fields.zipcode,
                        "Coords" : [req.fields.gpsLon,req.fields.gpsLat]
                    },
                    "Grades" : gradesArray,
                    "Owner" : req.fields.owner
                }
                if (req.files.imageToUpload.size >0) {
                console.log(`Update With Image`);
                        fs.readFile(req.files.imageToUpload.path, (err,data) => {
                            assert.equal(err,null);
                            photo = new Buffer.from(data).toString('base64');
                            photoMime = req.files.imageToUpload.type;
                            dbObject.Photo = photo;
                            dbObject.PhotoMimeType = photoMime;
                        });
                } else {
                    console.log(`Update Without Image`);
                }
                client.connect((err)=>{
                        assert.equal(null,err);
                        const db = client.db(dbName);
                        let DOCID = {};
                        DOCID['_id'] = ObjectID(req.fields._id);
                        updateDocument(db,"restaurant",DOCID,dbObject,(results)=>{
                            console.log(`Connection Closed`);
                            let dbArray = [];
                            dbArray[0] = dbObject;
                            res.redirect("/showDetails?_id="+req.fields._id)
                            res.status(200).render("showDetails",{
                                userInfo:req.session.username,
                                dbDocs: dbArray,
                                isShow : "success d-block",
                                errorMsg : "Modify Restaurant Successfully"

                        });
                    });
                });
            });
        });
    
});
//GET the Delete Restaurant Form
app.get("/deleteRestaurant",(req,res)=>{
    console.log(`Delete Restaurant (GET) ${req.query._id}`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
  
        res.status(200).render("confirmDelete",{
            userInfo:req.session.username,
            isShow : "danger d-block",
            errorMsg : "Are You Sure You Want To Delete?",
            path: req.query._id
        });

});
//Delete a new restaurant from mongodb
app.post('/deleteRestaurant', (req,res) => {
    console.log(`Delete Restaurant (POST)`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
        client.connect((err)=>{
            assert.equal(null,err);
            const db = client.db(dbName);
            let DOCID = {};
            DOCID['_id'] = ObjectID(req.fields._id);
            deleteDocument(db,"restaurant",DOCID,(results)=>{
                console.log(`Connection Closed`);
                console.log(`Successfully Deleted Document: ${results.result.n}`);
                if(results.result.n == 1){
                    res.status(200).render("notifyDeleted",{
                        userInfo:req.session.username,
                        isShow : "success d-block",
                        errorMsg : "Restaurant Deleted",
                        path: req.query._id
                    });
                }else{
                    res.redirect("/showError?t=uex&_id="+req.query._id);
                }
            });
        });
});
//GET the Leaflet Map API
app.get("/leaflet", (req,res) => {
    console.log(`Leaflet Map API (GET)`);
	res.render("leaflet", {
		lat:req.query.lat,
        lon:req.query.lon,
        zoom:req.query.zoom ? req.query.zoom : 15,
        name: req.query.name,
        userInfo: req.session.username
	});
	res.end();
});
//GET the Show Error Poage
app.get("/showError",(req,res)=>{
    console.log(`Showing Error, Type ${req.query.t}`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    let redirectPath = "";
    if(req.query._id == null){
        redirectPath = "/readDB"
    }else{
        redirectPath = "/showDetails?_id="+req.query._id;
    }
    let errorMsg = "";
    switch(req.query.t){
        case "ar":
            errorMsg = "You have already rated this restaurant";
        break;
        case "nam":
            errorMsg = "You are not authorized to modify this restaurant";
        break;
        case "uex":
            errorMsg = "unexpected Error, Cannot Delete";
        break;
        case "404":
            errorMsg = "404 Page Not Found";
        break;
        case "500":
            errorMsg = "Server Internal Error";
        break;
        case "502":
            errorMsg = "Server Running Out of Memory";
        break;
        default:
            errorMsg = "Unexpected Error Occurs"
        break;
    }
    
    res.status(200).render("showError",{
        userInfo:req.session.username,
        isShow : "warning d-block",
        errorMsg : errorMsg,
        path : redirectPath
    });
});
//GET the Search Restaurant Form
app.get("/search",(req,res)=>{
    console.log(`Search Restaurant (GET)`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
        res.status(200).render("search",{
            userInfo:req.session.username,
            isShow : "primary d-block",
            errorMsg : "Search Restaurant",
            dbDocs: [],
            errorMsg : "Leave the field(s) blank if not require matching",
            isShow : "primary d-block"
        });

});
//Search restaurants to mongodb
app.post("/search",(req,res)=>{
    console.log(`Search Restaurant (POST)`);
    if(!req.session.authenticated){
        res.redirect("/");
    }
    let name= req.fields.name;
    let nameExact= req.fields.nameExact;
    let nameCase= req.fields.nameCase;
    let borough = req.fields.borough;
    let boroughExact = req.fields.boroughExact;
    let boroughCase = req.fields.boroughCase;
    let cuisine = req.fields.cuisine;
    let cuisineExact = req.fields.cuisineExact;
    let cuisineCase = req.fields.cuisineCase;
    let dbCriteria = {
        "Name" : name,
        "Borough" : borough,
        "Cuisine" : cuisine
    }
    if(name.length == 0){
        delete dbCriteria.Name;
    }else{
        if(!(nameExact == "true")){
            if((nameCase == "true")){
                dbCriteria.Name = new RegExp('.*' + name + '.*');
            }else{
                dbCriteria.Name = new RegExp('.*' + name + '.*',"i");
            }
        }else{
            if(!(nameCase == "true")){
                dbCriteria.Name = new RegExp(name, "i");
            }  
        }
    }
    if(borough.length == 0){
        delete dbCriteria.Borough;
    }else{
        if(!(boroughExact == "true")){
            if((boroughCase == "true")){
                dbCriteria.Borough = new RegExp('.*' + borough + '.*');
            }else{
                dbCriteria.Borough = new RegExp('.*' + borough + '.*',"i");
            }
        }else{
            if((boroughCase == "true")){
                dbCriteria.Borough = new RegExp(borough, "i");
            }
        }
    }
    if(cuisine.length == 0){
        delete dbCriteria.Cuisine;
    }else{
        if(!(cuisineExact == "true")){
            if((cuisineCase == "true")){
                dbCriteria.Cuisine = new RegExp('.*' + cuisine + '.*');
            }else{
                dbCriteria.Cuisine = new RegExp('.*' + cuisine + '.*',"i");
            }
        }else{
            if((cuisineCase == "true")){
                dbCriteria.Cuisine = new RegExp(cuisine, "i");
            }
        }
    }
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            res.status(200).render("search",{
                userInfo:req.session.username,
                isShow : "primary d-block",
                errorMsg : "Search Results",
                path: req.query._id,
                dbDocs: results,
                errorMsg : "You Search Results",
                isShow : "success d-block"
            });
        });
    });
});
//RESTful Name
app.get("/api/restaurant/name/:name",(req,res)=>{
    let dbCriteria = {
        "Name" : req.params.name
    };
    let jsonArray = [];
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            if(results.length == 0)
                res.status(200).json({}).end();
            else
                res.status(200).json(results).end();
        });
    });
});
//RESTful Borough
app.get("/api/restaurant/borough/:borough",(req,res)=>{
    let dbCriteria = {
        "Borough" : req.params.borough
    };
    let jsonArray = [];
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            if(results.length == 0)
                res.status(200).json({}).end();
            else
                res.status(200).json(results).end();
        });
    });
});
//RESTful Cunsine
app.get("/api/restaurant/cuisine/:cuisine",(req,res)=>{
    let dbCriteria = {
        "Cuisine" : req.params.cuisine
    };
    let jsonArray = [];
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            if(results.length == 0)
                res.status(200).json({}).end();
            else
                res.status(200).json(results).end();
        });
    });
});
//RESTful Name + Borough
app.get("/api/restaurant/name/:name/borough/:borough",(req,res)=>{
    let dbCriteria = {
        "Name" : req.params.name,
        "Borough" : req.params.borough
    };
    let jsonArray = [];
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            if(results.length == 0)
                res.status(200).json({}).end();
            else
                res.status(200).json(results).end();
        });
    });
});
//RESTful Borough + Cuisine
app.get("/api/restaurant/borough/:borough/cuisine/:cuisine",(req,res)=>{
    let dbCriteria = {
        "Borough" : req.params.borough,
        "Cuisine" : req.params.cuisine
    };
    let jsonArray = [];
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            if(results.length == 0)
                res.status(200).json({}).end();
            else
                res.status(200).json(results).end();
        });
    });
});
//RESTful Name + Borough + Cuisine
app.get("/api/restaurant/name/:name/borough/:borough/cuisine/:cuisine",(req,res)=>{
    let dbCriteria = {
        "Name" : req.params.name,
        "Borough" : req.params.borough,
        "Cuisine" : req.params.cuisine
    };
    let jsonArray = [];
    client.connect((err)=>{
        assert.equal(null,err);
        const db = client.db(dbName);
        findAll(db,"restaurant",dbCriteria,(results)=>{
            console.log(`Connection Closed`);
            if(results.length == 0)
                res.status(200).json({}).end();
            else
                res.status(200).json(results).end();
        });
    });
});

// For 404 Page Not Found
app.use(function(req, res, next) {
    res.status(404);
    res.redirect("/showError?t=404");
    next();
});
// For 500 Page Not Found
app.use(function(req, res, next) {
    res.status(502);
    res.redirect("/showError?t=502");
    next();
});
app.listen(process.env.PORT || 8099);