import { CLEAN_INTERVAL_TIME, ROOM_STATES, USER_STATES } from "./constants.js";
import { rooms, users } from "./globals.js";
import { io } from "../index.js";
import { debugLog } from "./endpoints.js";

export function deleteAfkMenuUsers() {
  try {
    const now = new Date(Date.now());
    const afkUsers = Object.keys(users).filter(
      (username) =>
        users[username].state === USER_STATES.MENU &&
        now - users[username].lastAct > CLEAN_INTERVAL_TIME
    );

    afkUsers.forEach((username) => {
      delete users[username];
    });
    debugLog(`CleanUp - Deleted ${afkUsers.length} users from menu`);
  } catch (e) {
    console.error(e);
  }
}

export function deleteAfkLobbies() {
  try {
    const now = new Date(Date.now());
    const afkLobbies = Object.keys(rooms).filter(
      (roomCode) =>
        rooms[roomCode].state === ROOM_STATES.LOBBY &&
        now - rooms[roomCode].created > CLEAN_INTERVAL_TIME
    );

    afkLobbies.forEach((roomCode) => {
      rooms[roomCode].players.forEach((player) => {
        if (io.sockets.sockets.get(users[player].socket))
          io.sockets.sockets.get(users[player].socket).leave(roomCode);

        users[player] = {
          ...users[player],
          state: USER_STATES.MENU,
          roomCode: null,
        };

        io.to(users[player].socket).emit("user-update", users[player]);
      });
      delete rooms[roomCode];
    });
    debugLog(`CleanUp - Deleted ${afkLobbies.length} lobbies`);
  } catch (e) {
    console.error(e);
  }
}
