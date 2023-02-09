import {
  categories,
  rooms,
  users,
  publicRoomCodes,
  publicRooms,
} from "../globals.js";
import { ROOM_STATES, USER_STATES } from "../constants.js";
import { updateUserLastActivity } from "./users.js";
import { arrayRemove } from "../utils/universalUtils.js";

const generateCode = (len) => {
  const characters = "123456789ABCDEFGHJKLMNPRSTUXYZ";

  let isUnique = false;
  while (!isUnique) {
    var code = "";
    for (let i = 0; i < len; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    if (!(code in rooms)) isUnique = true;
  }

  return code;
};

export const createRoom = (username, socket, callback) => {
  if (!(username in users)) return;

  const newRoomCode = generateCode(4);

  rooms[newRoomCode] = {
    owner: username,
    public: false,
    state: ROOM_STATES.LOBBY,
    created: new Date(Date.now()),
    players: [username],
    emails: { [username]: users[username].email },
    blacklist: [],
    categories: [...categories],
  };

  users[username] = {
    ...users[username],
    state: USER_STATES.LOBBY,
    lastAct: new Date(Date.now()),
    roomCode: newRoomCode,
  };

  socket.join(newRoomCode);

  callback({
    userInfo: users[username],
    roomInfo: rooms[users[username].roomCode],
  });
};

export const cancelRoom = (username, io) => {
  if (!(username in users)) return;

  if (!(users[username].roomCode in rooms)) return;

  const roomCode = users[username].roomCode;
  if (rooms[roomCode].owner !== username) return;

  io.to(roomCode).emit("room-update", null);

  updateUserLastActivity(username);

  rooms[roomCode].players.forEach((player) => {
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
    console.log("canel-room socket: ", users[player].socket); // debug
  });

  delete rooms[roomCode];
};

export const joinRoom = (username, roomCode, callback, socket, io) => {
  if (!(username in users)) return;

  if (!(roomCode in rooms)) {
    callback("404");
    return;
  }

  if (
    rooms[roomCode].players.length >= 3 ||
    rooms[roomCode].players.includes(username)
  ) {
    callback("full");
    return;
  }

  let isBanned = false;
  rooms[roomCode].blacklist.forEach((bannedUser) => {
    if (bannedUser === username) {
      callback("banned");
      isBanned = true;
      return;
    }
  });
  if (isBanned) return;

  rooms[roomCode].players = [...rooms[roomCode].players, username];
  rooms[roomCode].emails[username] = users[username].email;

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
};

export const leaveRoom = (username, callback, socket, io) => {
  if (!(username in users)) return;

  const roomCode = users[username].roomCode;

  socket.leave(roomCode);

  arrayRemove(rooms[roomCode].players, username);

  delete rooms[roomCode].emails.username;

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
};

export const updateRoom = (username, roomInfo, io) => {
  if (!(username in users)) return;

  const roomCode = users[username].roomCode;

  if (!(roomCode in rooms)) return;
  if (rooms[roomCode].owner !== username) return;

  rooms[roomCode] = roomInfo;
  updatePublicRoomCodes(roomCode);
  updateUserLastActivity(username);

  io.to(roomCode).emit("room-update", rooms[roomCode]);
};

export const kickUserFromRoom = (username, kicked, io) => {
  if (!(username in users)) return;
  if (!(kicked in users)) return;
  const roomCode = users[username].roomCode;

  if (!(roomCode in rooms)) return;
  if (rooms[roomCode].owner != username) return;

  arrayRemove(rooms[roomCode].players, kicked);

  delete rooms[roomCode].emails.kicked;

  rooms[roomCode].blacklist = [...rooms[roomCode].blacklist, kicked];

  if (io.sockets.sockets.get(users[kicked].socket))
    io.sockets.sockets.get(users[kicked].socket).leave(users[kicked].roomCode);

  updateUserLastActivity(username);

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
};

const updatePublicRoomCodes = (roomCode) => {
  let change = false;

  if (publicRoomCodes.includes(roomCode)) {
    if (rooms[roomCode].public === false) {
      arrayRemove(publicRoomCodes, roomCode);
      change = true;
    }
  } else if (rooms[roomCode].public === true) {
    publicRoomCodes.push(roomCode);
    change = true;
  }

  if (!change) return;
};

const updatePublicRooms = () => {
  publicRooms.length = 0;

  publicRoomCodes.forEach((roomCode) => {
    if (roomCode in rooms) {
      publicRooms.push({
        roomCode: roomCode,
        capacity: rooms[roomCode].players.length,
        owner: rooms[roomCode].owner,
        categories: rooms[roomCode].categories,
      });
    }
  });
};

export const getPublicRooms = (callback) => {
  updatePublicRooms();

  callback(publicRooms);
};
