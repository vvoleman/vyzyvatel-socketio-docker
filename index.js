import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { debugLog } from "./src/utils/universalUtils.js";
import {
  createRoom,
  cancelRoom,
  joinRoom,
  leaveRoom,
  updateRoom,
  kickUserFromRoom,
  getPublicRooms,
} from "./src/logic/lobby.js";
import { rooms, users, categories } from "./src/globals.js";
import { getCategories } from "./src/getRequests.js";
import { updateUserOnLogin } from "./src/logic/users.js";
import {
  startGame,
  answerQuestion,
  answerPickRegion,
} from "./src/logic/game.js";

const app = express();
app.use(cors());

const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

getCategories(categories);

io.on("connection", (socket) => {
  debugLog(`New Socket Connection: ${socket.id}`);

  socket.on("login", (username, useremail, callback) => {
    updateUserOnLogin(username, useremail, socket, callback);
    debugLog(`Login: ${socket.id}, Username: ${username}, Email: ${useremail}`);
  });

  socket.on("create-room", (username, callback) => {
    createRoom(username, socket, callback);
    debugLog(`${username} created room: ${users[username].roomCode}`);
  });

  socket.on("cancel-room", (username) => {
    debugLog(`${username} canceled room ${users[username].roomCode}`);
    cancelRoom(username, io);
  });

  socket.on("join-room", (roomCode, username, callback) => {
    joinRoom(username, roomCode, callback, socket, io);
    debugLog(`${username} joined room: ${roomCode}`);
  });

  socket.on("leave-room", (username, callback) => {
    debugLog(`${username} left room: ${users[username].roomCode}`);
    leaveRoom(username, callback, socket, io);
  });

  socket.on("update-room", (username, roomInfo) => {
    updateRoom(username, roomInfo, io);
    debugLog(`${username} updated room ${users[username].roomCode} 
    ${JSON.stringify(rooms[users[username].roomCode], null, 2)}`);
  });

  socket.on("kick-room", (username, kicked) => {
    kickUserFromRoom(username, kicked, io);
    debugLog(`${username} kicked ${kicked} from ${users[username].roomCode}`);
  });

  socket.on("public-rooms", (callback) => {
    getPublicRooms(callback);
  });

  socket.on("start-game", (username) => {
    debugLog(`${username} started game ${users[username].roomCode}`);
    startGame(username);
  });

  socket.on("answer-question", (username, answer, auto) => {
    debugLog(
      `${username} answered question ${answer} in ${users[username].roomCode}`
    );
    answerQuestion(username, answer, auto);
  });

  socket.on("answer-pick-region", (username, answer) => {
    debugLog(
      `${username} answered pick region (${answer}) in ${users[username].roomCode}`
    );
    answerPickRegion(username, answer);
  });

  socket.on("send-message", (messData, username) => {
    debugLog(
      `${username} sent mess ${messData.message} in ${users[username].roomCode}`
    );
    socket.to(users[username].roomCode).emit("receive-message", messData);
  });

  socket.on("disconnect", (data) => {
    debugLog(`Disconnected: ${socket.id} ${data}`);
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING..");
  console.log("listening on port %d", server.address().port);
  console.log("----------------------");
});
