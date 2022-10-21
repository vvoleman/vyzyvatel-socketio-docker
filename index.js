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

const connections = {};
const users = {};
const rooms = {};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const UpdateUserLastActivity = (username) => {
  users[username] = {
    ...users[username],
    lastAct: new Date(Date.now()),
  };
};

io.on("connection", (socket) => {
  DEBUG && console.log(`CONNECTED: ${socket.id}`);

  socket.on("login", (username, email, callback) => {
    let isInUsers = username in users;

    if (isInUsers) {
      for (const [key, value] of Object.entries(connections)) {
        if (value === username) {
          delete connections[key];
          break;
        }
      }
      users[username] = {
        ...users[username],
        lastAct: new Date(Date.now()),
        socket: socket.id,
      };

      if (users[username].roomCode !== null) {
        socket.join(users[username].roomCode);
      }
    } else {
      users[username] = {
        username: username,
        email: email,
        state: USER_STATES.MENU,
        lastAct: new Date(Date.now()),
        roomCode: null,
        socket: socket.id,
      };
    }

    connections[socket.id] = username;

    callback({
      userState: users[username],
      lobbyState: rooms[users[username].roomCode],
    });

    DEBUG &&
      console.log(
        `LOGIN: ${socket.id}, username: ${username}, in dict users: ${isInUsers}`
      );
    DEBUG && console.log(`USERS DICT: ${JSON.stringify(users)}`);
    DEBUG && console.log(`CONNECTIONS DICT: ${JSON.stringify(connections)}`);
  });

  socket.on("create-room", (username, callback) => {
    const roomCode = generateCode(4, rooms);
    rooms[roomCode] = {
      owner: username,
      public: false,
      state: ROOM_STATES.LOBBY,
      created: new Date(Date.now()),
      players: [username],
      blacklist: [],
      categories: categories.map((cat) => {
        return { id: cat.id, name: cat.name, active: true };
      }),
    };

    users[username] = {
      ...users[username],
      state: USER_STATES.LOBBY,
      lastAct: new Date(Date.now()),
      roomCode: roomCode,
    };

    socket.join(users[username].roomCode);

    callback({
      userState: users[username],
      lobbyState: rooms[users[username].roomCode],
    });

    DEBUG && console.log(`socket: ${socket.id} created room: ${roomCode}`);
    DEBUG && console.log(`ROOMS DICT: ${JSON.stringify(rooms)}`);
  });

  socket.on("cancel-room", (username) => {
    if (!(users[username].roomCode in rooms)) return;
    if (rooms[users[username].roomCode].owner != username) return;

    io.to(users[username].roomCode).emit("room-update", null);

    UpdateUserLastActivity(username);

    const roomPlayers = rooms[users[username].roomCode].players;
    delete rooms[users[username].roomCode];

    roomPlayers.forEach((player) => {
      if (io.sockets.sockets.get(users[player].socket))
        io.sockets.sockets
          .get(users[player].socket)
          .leave(users[player].roomCode);

      users[player] = {
        ...users[player],
        state: USER_STATES.MENU,
        roomCode: null,
      };

      io.to(users[player].socket).emit("user-update", users[player]);
    });

    console.log(`socket: ${socket.id} canceled room`);
  });

  socket.on("join-room", (roomCode, username, callback) => {
    if (!(roomCode in rooms)) {
      DEBUG &&
        console.log(
          `socket: ${socket.id} tried to join non existing room: ${roomCode}`
        );
      callback("404");
      return;
    } else if (rooms[roomCode].players.length >= 3) {
      DEBUG &&
        console.log(
          `socket: ${socket.id} tried to join full room: ${roomCode}`
        );
      callback("full");
      return;
    }

    const blacklist = rooms[roomCode].blacklist;
    for (let i = 0; i < blacklist.length; i++) {
      if (blacklist[i] === username) {
        callback("banned");
        DEBUG &&
          console.log(
            `socket: ${socket.id} tried to join banned room: ${roomCode}`
          );
        return;
      }
    }

    rooms[roomCode].players = [...rooms[roomCode].players, username];
    users[username] = {
      ...users[username],
      state: USER_STATES.LOBBY,
      roomCode: roomCode,
    };

    callback({
      userState: users[username],
      lobbyState: rooms[roomCode],
    });

    io.to(roomCode).emit("room-update", rooms[roomCode]);
    socket.join(roomCode);

    DEBUG &&
      console.log(
        `socket: ${socket.id} joined room: ${users[username].roomCode}`
      );
  });

  socket.on("leave-room", (username, callback) => {
    DEBUG &&
      console.log(
        `socket: ${socket.id} leaved room: ${users[username].roomCode}`
      );

    socket.leave(users[username].roomCode);

    rooms[roomCode].players = arrayRemove(rooms[roomCode].players, username);
    io.to(users[username].roomCode).emit(
      "room-update",
      rooms[users[username].roomCode]
    );

    users[username] = {
      ...users[username],
      state: USER_STATES.MENU,
      roomCode: null,
      lastAct: new Date(Date.now()),
    };

    callback({
      userState: users[username],
      lobbyState: null,
    });
  });

  socket.on("update-room", (username, lobbyState) => {
    if (!(users[username].roomCode in rooms)) return;
    if (rooms[users[username].roomCode].owner !== username) return;
    DEBUG &&
      console.log(
        `socket: ${socket.id} updated room: ${users[username].roomCode}`
      );

    UpdateUserLastActivity(username);

    rooms[users[username].roomCode] = lobbyState;
    io.to(users[username].roomCode).emit(
      "room-update",
      rooms[users[username].roomCode]
    );
  });

  socket.on("kick-room", (username, kicked) => {
    if (!(users[username].roomCode in rooms)) return;
    if (rooms[users[username].roomCode].owner != username) return;
    DEBUG &&
      console.log(
        `socket: ${socket.id} ${username} kicked ${kicked} room: ${users[username].roomCode}`
      );

    rooms[users[username].roomCode].players = arrayRemove(
      rooms[users[username].roomCode].players,
      kicked
    );
    rooms[users[username].roomCode].blacklist = [
      ...rooms[users[username].roomCode].blacklist,
      kicked,
    ];

    if (io.sockets.sockets.get(users[kicked].socket))
      io.sockets.sockets
        .get(users[kicked].socket)
        .leave(users[kicked].roomCode);

    users[username] = {
      ...users[username],
      lastAct: new Date(Date.now()),
    };

    users[kicked] = {
      ...users[kicked],
      state: USER_STATES.MENU,
      roomCode: null,
    };
    io.to(users[kicked].socket).emit("user-update", users[kicked]);
    io.to(users[kicked].socket).emit("room-update", null);

    io.to(users[username].roomCode).emit(
      "room-update",
      rooms[users[username].roomCode]
    );
    DEBUG && console.log(`ROOMS DICT: ${JSON.stringify(rooms)}`);
  });

  socket.on("public-rooms", (callback) => {
    let publicRooms = [];

    for (let room in rooms) {
      if (rooms[room]["public"] === true) {
        let publicRoom = rooms[room];
        publicRoom = { ...publicRoom, roomCode: room };
        publicRooms.push(publicRoom);
      }
    }

    callback(publicRooms);
  });

  socket.on("send-message", (messData, username) => {
    DEBUG &&
      console.log(
        `socket: ${socket.id} ${username} sent mess ${messData.message} to room ${users[username].roomCode}`
      );
    socket.to(users[username].roomCode).emit("receive-message", messData);
  });

  socket.on("disconnect", (data) => {
    DEBUG && console.log(`DISCONNECTED: ${socket.id} ${data}`);
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING..");
  console.log("listening on port %d", server.address().port);
});
