import { users, rooms } from "../globals.js";
import { GAME_STATES, USER_STATES } from "../constants.js";
import { deepCopy } from "../utils/universalUtils.js";

export const updateUserLastActivity = (username) => {
  users[username] = {
    ...users[username],
    lastAct: new Date(Date.now()),
  };
};

export const updateUserOnLogin = (username, useremail) => {
  if (username in users) {
    users[username].lastAct = new Date(Date.now());
  } else {
    users[username] = {
      username: username,
      email: useremail,
      state: USER_STATES.MENU,
      lastAct: new Date(Date.now()),
      roomCode: null,
    };
  }
};

export const updateSocket = (username, socket) => {
  if (!(username in users)) return;

  users[username].socket = socket.id;

  if (users[username].roomCode === null) {
    callback({
      userInfo: users[username],
      roomInfo: null,
    });
    return;
  }

  socket.join(users[username].roomCode);

  if (users[username].state === USER_STATES.LOBBY) {
    callback({
      userInfo: users[username],
      roomInfo: rooms[users[username].roomCode],
    });
    return;
  }

  const roomInfo = deepCopy(rooms[users[username].roomCode]);

  try {
    if (
      roomInfo.currentQuestion &&
      roomInfo.gameState === GAME_STATES.QUESTION_GUESS
    ) {
      delete roomInfo.currentQuestion.rightAnswer;
      roomInfo.currentQuestion.answers =
        roomInfo.currentQuestion.answers.filter(
          (answer) => answer.username === username
        );
    }
  } catch (e) {}

  callback({
    userInfo: users[username],
    roomInfo: roomInfo,
  });
};
