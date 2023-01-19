import { users, rooms } from "../globals.js";
import { USER_STATES } from "../constants.js";
import { deepCopy } from "../utils/universalUtils.js";

export const updateUserLastActivity = (username) => {
  users[username] = {
    ...users[username],
    lastAct: new Date(Date.now()),
  };
};

export const updateUserOnLogin = (username, useremail, socket, callback) => {
  if (username in users) {
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

  if (users[username].roomCode === null) {
    callback({
      userInfo: users[username],
      roomInfo: null,
    });
  }

  const roomInfo = deepCopy(rooms[users[username].roomCode]);

  try {
    roomInfo.currentQuestion.answers = roomInfo.currentQuestion.answers.filter(
      (answer) => answer.username === username
    );
  } catch (e) {}

  callback({
    userInfo: users[username],
    roomInfo: roomInfo,
  });
};
