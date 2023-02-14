import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import {
  createRoom,
  cancelRoom,
  joinRoom,
  leaveRoom,
  updateRoom,
  kickUserFromRoom,
  getPublicRooms,
} from "./src/logic/lobby.js";
import { users, categories } from "./src/globals.js";
import { getCategories } from "./src/getRequests.js";
import { updateSocket } from "./src/logic/users.js";
import {
  startGame,
  answerQuestion,
  answerPickRegion,
  answerAttackRegion,
} from "./src/logic/game.js";
import { endpoints, debugLog } from "./src/endpoints.js";
import { CLEAN_INTERVAL_TIME } from "./src/constants.js";
import { deleteAfkLobbies, deleteAfkMenuUsers } from "./src/cleanups.js";

const TRUSTED_ORIGINS = [
  "https://vyzyvatel.vercel.app",
  "https://vyzyva.tel",
  "https://www.vyzyva.tel",
];

const app = express();
app.use(
  cors({
    origin: TRUSTED_ORIGINS,
    methods: ["GET", "POST"],
  })
);

const server = http.createServer(app);
server.prependListener("request", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", TRUSTED_ORIGINS);
});
export const io = new Server(server, {
  cors: {
    origin: TRUSTED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

getCategories(categories);
endpoints(app);

setInterval(() => {
  deleteAfkMenuUsers();
  deleteAfkLobbies();
}, CLEAN_INTERVAL_TIME);

io.on("connection", (socket) => {
  socket.on("connect", () => {
    debugLog(`Socket: ${socket.id} connected`);
  });

  socket.on("disconnect", () => {
    debugLog(`Socket: ${socket.id} disconnected, user: ${users[socket.id]}`);
  });

  socket.on("update-socket", (username, useremail, callback) => {
    try {
      debugLog(`Socket: ${socket.id}, updated for ${username}`);
      updateSocket(username, useremail, socket, callback);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("create-room", (username, callback) => {
    try {
      createRoom(username, socket, callback);
      debugLog(`${username} created room: ${users[username].roomCode}`);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("cancel-room", (username) => {
    try {
      debugLog(`${username} canceled room ${users[username].roomCode}`);
      cancelRoom(username, io);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("join-room", (roomCode, username, callback) => {
    try {
      debugLog(`${username} joined room: ${roomCode}`);
      joinRoom(username, roomCode, callback, socket, io);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("leave-room", (username, callback) => {
    try {
      debugLog(`${username} left room: ${users[username].roomCode}`);
      leaveRoom(username, callback, socket, io);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("update-room", (username, roomInfo) => {
    try {
      debugLog(`${username} updated room ${users[username].roomCode}`);
      updateRoom(username, roomInfo, io);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("kick-room", (username, kicked) => {
    try {
      debugLog(`${username} kicked ${kicked} from ${users[username].roomCode}`);
      kickUserFromRoom(username, kicked, io);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("public-rooms", (callback) => {
    try {
      getPublicRooms(callback);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("start-game", (username) => {
    try {
      debugLog(`${username} started game ${users[username].roomCode}`);
      startGame(username);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("answer-question", (username, answer, auto) => {
    try {
      debugLog(
        `${username} answered question ${answer} in ${users[username].roomCode}`
      );
      answerQuestion(username, answer, auto);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("answer-pick-region", (username, answer) => {
    try {
      debugLog(
        `${username} answered pick region (${answer}) in ${users[username].roomCode}`
      );
      answerPickRegion(username, answer);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("answer-attack-region", (username, answer) => {
    try {
      debugLog(
        `${username} answered attack region (${answer}) in ${users[username].roomCode}`
      );
      answerAttackRegion(username, answer);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("send-message", (messData, username) => {
    try {
      debugLog(
        `${username} sent mess ${messData.message} in ${users[username].roomCode}`
      );
      socket.to(users[username].roomCode).emit("receive-message", messData);
    } catch (error) {
      console.log(error);
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING..");
  console.log("listening on port %d", server.address().port);
  console.log("----------------------");
});
