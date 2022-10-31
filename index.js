import fetch from "node-fetch";
import express, { json } from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import {
  DEBUG,
  USER_STATES,
  ROOM_STATES,
  QUESTION_TYPES,
  BACKEND_URL,
} from "./constants.js";
import { generateCode, arrayRemove, shuffleArray } from "./utils.js";

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
const questionSets = {};

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

  socket.on("login", (username, useremail, callback) => {
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
        email: useremail,
        state: USER_STATES.MENU,
        lastAct: new Date(Date.now()),
        roomCode: null,
        socket: socket.id,
      };
    }

    connections[socket.id] = username;

    callback({
      userInfo: users[username],
      roomInfo:
        users[username].roomCode === null
          ? null
          : rooms[users[username].roomCode],
    });

    DEBUG &&
      console.log(
        `LOGIN: ${socket.id}, username: ${username}, useremail: ${useremail}, in dict users: ${isInUsers} `
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
      emails: [users[username].email],
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

    socket.join(roomCode);

    callback({
      userInfo: users[username],
      roomInfo: rooms[roomCode],
    });

    DEBUG && console.log(`socket: ${socket.id} created room: ${roomCode}`);
    DEBUG && console.log(`ROOMS DICT: ${JSON.stringify(rooms)}`);
  });

  socket.on("cancel-room", (username) => {
    if (!(users[username].roomCode in rooms)) return;
    const roomCode = users[username].roomCode;
    if (rooms[roomCode].owner != username) return;

    io.to(roomCode).emit("room-update", null);

    UpdateUserLastActivity(username);

    const roomPlayers = rooms[roomCode].players;
    delete rooms[roomCode];

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
    rooms[roomCode].emails = [...rooms[roomCode].emails, users[username].email];
    users[username] = {
      ...users[username],
      state: USER_STATES.LOBBY,
      roomCode: roomCode,
    };

    callback({
      userInfo: users[username],
      roomInfo: rooms[roomCode],
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

    const roomCode = users[username].roomCode;
    socket.leave(roomCode);

    rooms[roomCode].players = arrayRemove(rooms[roomCode].players, username);
    rooms[roomCode].emails = arrayRemove(
      rooms[roomCode].emails,
      users[username].email
    );
    io.to(roomCode).emit("room-update", rooms[roomCode]);

    users[username] = {
      ...users[username],
      state: USER_STATES.MENU,
      roomCode: null,
      lastAct: new Date(Date.now()),
    };

    callback({
      userInfo: users[username],
      roomInfo: null,
    });
  });

  socket.on("update-room", (username, roomInfo) => {
    if (!(users[username].roomCode in rooms)) return;
    const roomCode = users[username].roomCode;
    if (rooms[roomCode].owner !== username) return;
    DEBUG && console.log(`socket: ${socket.id} updated room: ${roomCode}`);

    UpdateUserLastActivity(username);

    rooms[roomCode] = roomInfo;
    io.to(roomCode).emit("room-update", rooms[roomCode]);
  });

  socket.on("kick-room", (username, kicked) => {
    if (!(users[username].roomCode in rooms)) return;
    const roomCode = users[username].roomCode;
    if (!(roomCode in rooms)) return;
    if (rooms[roomCode].owner != username) return;
    DEBUG &&
      console.log(
        `socket: ${socket.id} ${username} kicked ${kicked} room: ${roomCode}`
      );

    rooms[roomCode].players = arrayRemove(rooms[roomCode].players, kicked);
    rooms[roomCode].emails = arrayRemove(
      rooms[roomCode].emails,
      users[kicked].email
    );
    rooms[roomCode].blacklist = [...rooms[roomCode].blacklist, kicked];

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

  const getQuestions = async (roomCode) => {
    let ids = [];
    rooms[roomCode].categories.forEach((cat) => {
      if (cat.active === true) {
        ids.push(cat.id);
      }
    });

    let response = await fetch(BACKEND_URL + "/api/questions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ categories: ids }),
    });
    let questions = await response.json();
    questionSets[roomCode] = questions;
    let currentQuestion = questionSets[roomCode].pickQuestions.pop();
    currentQuestion.wrong_answers.push(currentQuestion.right_answer);
    currentQuestion = {
      id: currentQuestion.id,
      question: currentQuestion.question,
      possibleAnswers: shuffleArray(currentQuestion.wrong_answers),
      type: QUESTION_TYPES.PICK,
    };

    delete rooms[roomCode].categories;
    delete rooms[roomCode].blacklist;
    delete rooms[roomCode].public;

    rooms[roomCode].currentQuestion = currentQuestion;

    rooms[roomCode].players.forEach((player) => {
      users[player] = {
        ...users[player],
        state: USER_STATES.GAME,
      };
      io.to(users[player].socket).emit("user-update", users[player]);
    });
    io.to(roomCode).emit("room-update", rooms[roomCode]);

    DEBUG && console.log(`start game: ${roomCode}`);
  };

  socket.on("start-game", (username) => {
    if (!(username in users)) return;
    const roomCode = users[username].roomCode;
    if (rooms[roomCode].owner !== username) return;
    if (rooms[roomCode].state !== ROOM_STATES.LOBBY) return;
    rooms[roomCode] = {
      ...rooms[roomCode],
      state: ROOM_STATES.GAME,
      started: new Date(Date.now()),
    };
    getQuestions(roomCode);
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
