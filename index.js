var app = require('express')();
var port = 42111;
var http = require('http').Server(app);
var gameroom = require('./Gameroom');
var mysql = require('mysql');
var pool = mysql.createPool({
    connectionLimit: 15,
    host: "34.91.71.17",
    user: "root",
    password: "HruHff673me5aGnh", // +;(Dp~s(aDBf
    database : "quizcatie"
});
var bodyParser = require('body-parser');

const io = require('socket.io')(http,{
  cors: {
    origin: "https://quizcatie.nl",
    methods: ["GET", "POST"]
  }
});



const cors = require('cors');


app.use(cors());
app.options('*', cors());
app.use( require('express').static( "public" ) );


app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// set the view engine to ejs
app.set('view engine', 'ejs');


//ROUTE
app.use('',gameroom);

// END ROUTE
let ROOMS = new Map(); // container all rooms creating by key = roomid

let roomObject = {
    roomid : 0,
    master : "master pseudo",
    here : [], // array container user defined by (socketid , pseudo , answer cheked true or false )
    usersAnswers : {},
};




io.on('connection', function(socket){

  socket.on('create room', function(data){
      console.log("Socket : "+socket.id + " creating room : "+data.roomid + " with master : "+data.masterName.pseudo);
      let room = {
          roomid : data.roomid,
          master : data.masterName,
          here : new Array(data.masterName), // array container user defined by (socketid , pseudo , answer cheked true or false )
          usersAnswers : {},
      };
      // ROOMS.get(data.roomid).data.roomid;
      // ROOMS[data.roomid].master = data.masterName;
      // ROOMS[data.roomid].here.push(data.masterName);
      // console.log("_ROOMS : "+ROOMS[data.roomid]);
      ROOMS.set(data.roomid,room);
      socket.join(data.roomid);
      printUsers(data.roomid);

      // console.log(" socket id : " + data.masterName.pseudo + "  try to creat a room but in already in one ")

    // socket.to(roomObject.roomid).emit('here',roomObject.here);
  });

  //on joiner room

  socket.on('join room', function(data){
    console.log("Socket : "+socket.id + " joining room : "+data.roomid + " with master : "+roomObject.master +
        " with pseudo : "+data.user.pseudo + "and : " +data.user.answerscheck);
    socket.join(data.roomid);
    ROOM(data.roomid).here.push(data.user);
    printUsers(data.roomid);
    // then envoyer a tt les gens qui ont deja rjoin la room la liste des joiners
    console.log("sending to : " + data.roomid +" joining user event with : "+data.user.pseudo);
    socket.to(data.roomid).emit('joining',data.user); // sending joining user to present user in room except sender
    // io.to(roomObject.roomid).emit('here',roomObject.here);
  });

  socket.on('getusinroom', (data) => {
    io.to(data.socketid).emit('usinroom',ROOM(data.roomid).here);
  });


  //leaving room or closing the tab
  socket.on('disconnecting', () => {
      let set = socket.rooms.values();
    let socketid = set.next().value;
    let roomid = set.next().value;

    removeWhere(roomid,socketid);
    io.to(roomid).emit('leaving',socketid);
  });


  // le creator a lancer la game avec une theme id
  socket.on('launchGame', ( data) => {
    console.log("laucnhing game to roomid : "+ data.roomid +"with id du theme " + data.themeid + " with "+ROOM(data.roomid).here.length + " users");
    // send laucnhing game event with theme questions

    let questions = {};
    pool.getConnection(function(err, con) {
        if (err) throw err;
        // console.log("QUERY THEME ID  :" +data.themeid  );
        con.query("SELECT themes.name, questions.id ,questions.intitule, questions.expectedAns "+
          "FROM `questions` INNER JOIN q_a_s ON questions.id = q_a_s.question_id INNER JOIN themes on q_a_s.theme_id = themes.id "+
          "WHERE q_a_s.theme_id ="+ data.themeid +" ORDER by questions.id" , function (err, result) {
            if (err) throw err;

            questions = result;
            //console.log("questions  "+questions);
            // console.log("here users   "+roomObject.here);

            ROOM(data.roomid).usersAnswers = {};
            console.log("/*** USER ANSWERS INIT ***/")
            ROOM(data.roomid).here.forEach((element) => {
                ROOM(data.roomid).usersAnswers[element.pseudo] = {};
                // console.log(element.pseudo + " : "+roomObject.usersAnswers[element.pseudo]);
                for (let i = 0; i < questions.length; i++) {
                    ROOM(data.roomid).usersAnswers[element.pseudo][i] = false;
                    // console.log(roomObject.usersAnswers[element.pseudo][i]);
                }

                // console.log(" socket id : "+element.socketid + " pseudo : " +element.pseudo);
            });

            // console.log(" roomObject.here " + roomObject.here.length);
            // console.log(" roomObject.user " +  len(roomObject.usersAnswers));
            io.in(data.roomid).emit('launchingame',{
                questions : questions,
                users : ROOM(data.roomid).here
            });

        });
        con.release();
    });
  });

  socket.on('userresults', (data) => {
      //populate roomobj.useranwsers
      // console.log(checkAlldefined(data.roomid) + " room :  "+data.roomid);

      if (ROOM(data.roomid).usersAnswers.hasOwnProperty(data.user.pseudo)){

          let index = ROOM(data.roomid).here.findIndex(v => v.socketid === data.user.socketid);
          console.log("inserting result for " + data.user.pseudo + " at index : " +index);
          ROOM(data.roomid).here[index].answerscheck = true;
          ROOM(data.roomid).usersAnswers[data.user.pseudo] = data.user.answers;
      }
      // var length = len(ROOMS[data.roomid].usersAnswers);
      // console.log(checkAlldefined(data.roomid));
      if (checkAlldefined(data.roomid)){
        console.log("on a tous les rslt de tlm dans la room sending data to users"); // working
          io.in(data.roomid).emit('alluserresults',ROOM(data.roomid).usersAnswers);
      }
  });

    socket.on('masterNextResult', (data) => {
        // tell everyon in this room to show next results
        console.log(" next results : " + data.qindex +" to room " + data.roomid);
        io.in(data.roomid).emit('nextResult',data.qindex);
    });


});

http.listen(port, function(){
  console.log('listening on *:' + port);
});

//remove usser with socketid from roomid
// then check if there is no other player in room
// if true remove key : roomid from ROOMS
function removeWhere(roomid,socketid){
    // printUsers(roomid);
    if (ROOMS.has(roomid)){
        console.log("remove socket id : "+socketid +" from room : "+roomid + " at index "+ ROOM(roomid).here.findIndex(v => v.socketid === socketid));
        ROOM(roomid).here.splice(ROOM(roomid).here.findIndex(v => v.socketid === socketid), 1);
        let usercount = ROOM(roomid).here.length;
        if (usercount <= 0){
            printRooms();
            console.log("deleting roomid key " + roomid);
            ROOMS.delete(roomid);
            printRooms();
        }

    }
    // printUsers(roomid);
  //https://stackoverflow.com/questions/10024866/remove-object-from-array-using-javascript
}

function printUsers(roomid){
  console.log("printing user for room " +roomid+ " : ");
  ROOMS.get(roomid).here.forEach((element) => {
    console.log(" socket id : "+element.socketid + " pseudo : " +element.pseudo + "check : " +element.answerscheck);
  });
}

function printRooms(){
    console.log("printing ROOMS " );
    console.log(ROOMS);
}


function checkAlldefined(roomid){
    for (let i = 0; i < ROOM(roomid).here.length; i++) {
        if (!ROOM(roomid).here[i].answerscheck){
            return false;
        }
    }
    return true;
}

function ROOM(id) {
    return ROOMS.get(id);
}