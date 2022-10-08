const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { generateCode } = require("./utils");
const { DEBUG, USER_STATES, ROOM_STATES } = require("./constants");

app.use(cors());

const rooms = {};
const users = {};
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  DEBUG && console.log(`socket connected: ${socket.id}`);

  socket.on("login", (username) => {
    let isInDict = false;
    for (let socketid in users) {
      let userdata = users[socketid];
      if (userdata["username"] == username) {
        users[socket.id] = {
          username: username,
          state: userdata["state"],
          lastAct: new Date(Date.now()),
        };
        if (socket.id !== socketid) delete users[socketid];
        isInDict = true;
        break;
      }
    }

    if (!isInDict) {
      users[socket.id] = {
        username: username,
        state: USER_STATES.MENU,
        lastAct: new Date(Date.now()),
      };
    }

    DEBUG &&
      console.log(
        `socket: ${socket.id} login, username: ${username}, in dict: ${isInDict}`
      );

    DEBUG && console.log(`USERS DICT: ${JSON.stringify(users)}`);
  });

  socket.on("create-room", (username, callback) => {
    const roomCode = generateCode(4, rooms);
    rooms[roomCode] = {
      owner: username,
      state: ROOM_STATES.MENU,
      created: new Date(Date.now()),
      players: [username],
    };

    socket.join(roomCode);
    socket.emit("room-code", roomCode);

    callback(roomCode);

    DEBUG && console.log(`socket: ${socket.id} created room: ${roomCode}`);
    DEBUG && console.log(`ROOMS DICT: ${JSON.stringify(rooms)}`);
  });

  socket.on("cancel-room", (roomCode, username, callback) => {
    if (!(roomCode in rooms)) return;
    if (rooms[roomCode]["owner"] != username) return;

    delete rooms[roomCode];
    callback("ok");

    console.log(`user with id: ${socket.id} canceled room: ${roomCode}`);
  });

  socket.on("join-room", (roomCode) => {
    if (!(roomCode in rooms)) {
      DEBUG &&
        console.log(
          `socket: ${socket.id} tried to join non existing room: ${roomCode}`
        );
      return;
    }
    DEBUG && console.log(`socket: ${socket.id} joined room: ${roomCode}`);

    socket.join(roomCode);
  });

  socket.on("leave-room", (data) => {
    socket.console.log(`user with id: ${socket.id} leaved room: ${data}`);
  });

  socket.on("send-message", (data) => {
    console.log(data);
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", (data) => {
    DEBUG && console.log(`socket disconnected: ${socket.id}`);
  });

  socket.on("hello", (data) => {
    console.log(`hello id: ${socket.id}, message: ${data}`);
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING..");
  console.log("listening on port %d", server.address().port);
});
