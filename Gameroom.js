var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var nano = require('nanoid'); //https://github.com/ai/nanoid/


var pool = mysql.createPool({
    connectionLimit: 15,
    host: "localhost",
    user: "quizcati_root",
    password: "+;(Dp~s(aDBf", // +;(Dp~s(aDBf
    database : "quizcati_quizcatie"
});


// define the home page route
router.get('/', function(req, res) {
    res.render(__dirname + '/CreateRoom',{
        baseURL : req.protocol + 's://' +req.get('host'),
        id : nano.nanoid(11)
    });
    // res.sendFile(__dirname + '/CreateRoom.html');
});

router.get('/:roomid', function(req, res) {
    // res.send('Rejoindre la room'+req.params.roomid);
    var themes;
    pool.getConnection(function(err, con) {
        if (err) throw err;
        // console.log("Connecté à la base de données MySQL!");
        con.query("SELECT * from themes ", function (err, result) {
            if (err) throw err;
            themes = result;
        });
        con.release();
    });


    res.render(__dirname + '/joinroom',{
        themes : themes,
        roomid : req.params.roomid,
        baseURL : req.protocol + 's://' +req.get('host')
    });
});



//Ta rentrer ton pseudo pour creer une room
router.post('/:roomid', function(req, res) {
    var themes = {};
    pool.getConnection(function(err, con) {
        if (err) throw err;
        // console.log("Connecté à la base de données MySQL!");
        con.query("SELECT * from themes ", function (err, result) {
            if (err) throw err;
            // console.log("RESULT "+result);
            themes = result;
            // console.log("THEMES "+themes);

            // send response when database is closed
            res.render(__dirname + '/gameroom',{
                themes : themes,
                yourpseudo : req.body.you,
                roomid : req.params.roomid,
                baseURL : req.protocol + 's://' +req.get('host')
            });

        });
        con.release();



    });




});

module.exports = router;

