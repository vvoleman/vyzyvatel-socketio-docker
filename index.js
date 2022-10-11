import fetch from "node-fetch";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { DEBUG, USER_STATES, ROOM_STATES, BACKEND_URL } from "./constants.js";
import { generateCode, arrayRemove } from "./utils.js";

const app = express();
app.use(cors());

let categories = [];
const getCategories = async () => {
  let response = await fetch(BACKEND_URL + "/api/categories/", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  categories = await response.json();
};
getCategories();

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
  DEBUG && console.log(`CONNECTED: ${socket.id}`);

  socket.on("login", (username, callback) => {
    let isInDict = false;
    for (let socketid in users) {
      let userdata = users[socketid];
      if (userdata["username"] == username) {
        users[socket.id] = {
          username: username,
          state: userdata["state"],
          lastAct: new Date(Date.now()),
        };

        if (socket.id !== socketid) {
          delete users[socketid];
        }

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

    let roomCode = null;
    if (users[socket.id].state != USER_STATES.MENU) {
      for (let room in rooms) {
        let roomdata = rooms[room];
        let players = roomdata["players"];
        let isInPlayers = false;
        for (let i = 0; i < 3; i++) {
          if (players[i] === username) {
            roomCode = room;
            socket.join(roomCode);
            isInPlayers = true;
            break;
          }
        }

        if (isInPlayers) break;
      }
    }

    callback({
      roomCode: roomCode,
      userState: users[socket.id],
      lobbyState: rooms[roomCode],
    });

    DEBUG &&
      console.log(
        `LOGIN: ${socket.id}, username: ${username}, in dict: ${isInDict}`
      );

    DEBUG && console.log(`USERS DICT: ${JSON.stringify(users)}`);
  });

  socket.on("create-room", (username, callback) => {
    const roomCode = generateCode(4, rooms);
    rooms[roomCode] = {
      owner: username,
      public: false,
      state: ROOM_STATES.MENU,
      created: new Date(Date.now()),
      players: [username],
      blacklist: [],
      categories: categories.map((cat) => {
        return { id: cat.id, name: cat.name, active: true };
      }),
    };

    socket.join(roomCode);
    users[socket.id] = {
      ...users[socket.id],
      state: USER_STATES.LOBBY,
      lastAct: new Date(Date.now()),
    };
    callback({
      roomCode: roomCode,
      userState: users[socket.id],
      lobbyState: rooms[roomCode],
    });

    DEBUG && console.log(`socket: ${socket.id} created room: ${roomCode}`);
    DEBUG && console.log(`ROOMS DICT: ${JSON.stringify(rooms)}`);
  });

  socket.on("cancel-room", (roomCode, username) => {
    if (!(roomCode in rooms)) return;
    if (rooms[roomCode]["owner"] != username) return;

    users[socket.id] = {
      ...users[socket.id],
      state: USER_STATES.MENU,
      lastAct: new Date(Date.now()),
    };

    io.to(roomCode).emit("room-update", { lobbyState: null });

    const players = rooms[roomCode]["players"];
    for (let i = 0; i < players.length; i++) {
      for (let userid in users) {
        if (users[userid]["username"] === players[i]) {
          users[userid] = { ...users[userid], state: USER_STATES.MENU };
          io.to(userid).emit("user-update", {
            roomCode: null,
            userState: users[userid],
          });
          if (io.sockets.sockets.get(userid))
            io.sockets.sockets.get(userid).leave(roomCode);
          break;
        }
      }
    }

    delete rooms[roomCode];
    console.log(`socket: ${socket.id} canceled room: ${roomCode}`);
  });

  socket.on("join-room", (roomCode, username, callback) => {
    if (!(roomCode in rooms)) {
      DEBUG &&
        console.log(
          `socket: ${socket.id} tried to join non existing room: ${roomCode}`
        );
      callback("404");
      return;
    } else if (rooms[roomCode]["players"].length >= 3) {
      DEBUG &&
        console.log(
          `socket: ${socket.id} tried to join full room: ${roomCode}`
        );
      callback("full");
      return;
    }

    const blacklisted = rooms[roomCode]["blacklist"];
    console.log("blacklist:" + JSON.stringify(blacklisted));
    for (let i = 0; i < blacklisted.length; i++) {
      if (blacklisted[i] === username) {
        callback("banned");
        return;
      }
    }
    DEBUG && console.log(`socket: ${socket.id} joined room: ${roomCode}`);
    rooms[roomCode]["players"] = [...rooms[roomCode]["players"], username];

    for (let userid in users) {
      if (users[userid]["username"] === username) {
        users[userid] = { ...users[userid], state: USER_STATES.LOBBY };
      }
    }

    callback({
      roomCode: roomCode,
      userState: users[socket.id],
      lobbyState: rooms[roomCode],
    });

    io.to(roomCode).emit("room-update", { lobbyState: rooms[roomCode] });

    socket.join(roomCode);
  });

  socket.on("leave-room", (roomCode, username, callback) => {
    DEBUG && console.log(`socket: ${socket.id} leaved room: ${roomCode}`);

    socket.leave(roomCode);

    rooms[roomCode]["players"] = arrayRemove(
      rooms[roomCode]["players"],
      username
    );
    io.to(roomCode).emit("room-update", { lobbyState: rooms[roomCode] });

    for (let userid in users) {
      if (users[userid]["username"] === username) {
        users[userid] = { ...users[userid], state: USER_STATES.MENU };
      }
    }

    callback({
      roomCode: null,
      userState: users[socket.id],
      lobbyState: null,
    });
  });

  socket.on("update-room", (roomCode, username, lobbyState) => {
    if (!(roomCode in rooms)) return;
    if (rooms[roomCode]["owner"] != username) return;
    DEBUG && console.log(`socket: ${socket.id} updated room: ${roomCode}`);

    rooms[roomCode] = lobbyState;
    io.to(roomCode).emit("room-update", { lobbyState: rooms[roomCode] });
  });

  socket.on("kick-room", (roomCode, username, kicked) => {
    if (!(roomCode in rooms)) return;
    if (rooms[roomCode]["owner"] != username) return;
    DEBUG &&
      console.log(
        `socket: ${socket.id} ${username} kicked ${kicked} room: ${roomCode}`
      );

    for (let userid in users) {
      if (users[userid]["username"] === kicked) {
        users[userid] = { ...users[userid], state: USER_STATES.MENU };
        io.to(userid).emit("user-update", {
          roomCode: null,
          userState: users[userid],
        });
        if (io.sockets.sockets.get(userid))
          io.sockets.sockets.get(userid).leave(roomCode);
        break;
      }
    }

    rooms[roomCode]["players"] = arrayRemove(
      rooms[roomCode]["players"],
      kicked
    );

    rooms[roomCode]["blacklist"] = [...rooms[roomCode]["blacklist"], kicked];

    io.to(roomCode).emit("room-update", { lobbyState: rooms[roomCode] });
  });

  socket.on("send-message", (messData, username, roomCode) => {
    DEBUG &&
      console.log(
        `socket: ${socket.id} ${username} sent mess ${messData.message} to room ${roomCode}`
      );
    socket.to(roomCode).emit("receive-message", messData);
  });

  socket.on("disconnect", (data) => {
    DEBUG && console.log(`DISCONNECTED: ${socket.id}`);
  });

  socket.on("hello", (data) => {
    console.log(`hello id: ${socket.id}, message: ${data}`);
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING..");
  console.log("listening on port %d", server.address().port);
});
