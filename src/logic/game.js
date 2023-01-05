import {
  QUESTION_TYPES,
  USER_STATES,
  ROOM_STATES,
  GAME_STATES,
  GAME_TIMERS,
  NUMBER_OF_REGIONS,
} from "../constants.js";
import { users, rooms } from "../globals.js";
import { getQuestionSet } from "../getRequests.js";
import {
  shuffleArray,
  deepCopyDict,
  waitMiliseconds,
} from "../utils/universalUtils.js";
import { defaultMapInfo } from "../defaults.js";
import { io } from "../../index.js";
import {
  isInAnswers,
  pickPlayerColors,
  popQuestionFromSet,
  isPlayerRegionNeighbor,
} from "../utils/gameUtils.js";

Array.prototype.sortByDifferenceTime = function (array) {
  this.sort((obj1, obj2) => {
    if (obj1.difference < obj2.difference) {
      return -1;
    } else if (obj1.difference > obj2.difference) {
      return 1;
    } else {
      if (obj1.time < obj2.time) {
        return -1;
      } else if (obj1.time > obj2.time) {
        return 1;
      } else {
        return 0;
      }
    }
  });
  return this;
};

export const startGame = async (username) => {
  if (!(username in users)) return;

  const roomCode = users[username].roomCode;

  if (rooms[roomCode].owner !== username) return;
  if (rooms[roomCode].state !== ROOM_STATES.LOBBY) return;
  //if (rooms[roomCode].players.length !== 3) return;

  await getQuestionSet(roomCode);

  delete rooms[roomCode].categories;
  delete rooms[roomCode].blacklist;
  delete rooms[roomCode].public;

  rooms[roomCode] = {
    ...rooms[roomCode],
    state: ROOM_STATES.GAME,
    gameState: GAME_STATES.START,
    map: defaultMapInfo(),
    playersColor: pickPlayerColors(rooms[roomCode].players),
    started: new Date(Date.now()),
  };

  const shuffledPlayers = shuffleArray(rooms[roomCode].players);
  rooms[roomCode].map[1].owner = shuffledPlayers[0];
  rooms[roomCode].map[2].owner = shuffledPlayers[1];
  rooms[roomCode].map[11].owner = shuffledPlayers[2];

  rooms[roomCode].players.forEach((player) => {
    users[player] = {
      ...users[player],
      state: USER_STATES.GAME,
    };
    io.to(users[player].socket).emit("user-update", users[player]);
  });

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.START);

  askQuestionAll(roomCode);
};

const askQuestionAll = (roomCode) => {
  console.log("askQuestionAll " + roomCode);

  popQuestionFromSet(roomCode, QUESTION_TYPES.NUMERIC);

  rooms[roomCode] = {
    ...rooms[roomCode],
    gameState: GAME_STATES.ALL_GUESS,
    currentQuestion: {
      ...rooms[roomCode].currentQuestion,
      startTime: new Date().getTime() + GAME_TIMERS.QUESTION_READY,
      endTime:
        new Date().getTime() +
        GAME_TIMERS.QUESTION_READY +
        GAME_TIMERS.QUESTION_GUESS,
      answers: [],
    },
  };

  const clientRoomInfo = deepCopyDict(rooms[roomCode]);
  delete clientRoomInfo.currentQuestion.rightAnswer;
  delete clientRoomInfo.currentQuestion.answers;

  io.to(roomCode).emit("room-update", clientRoomInfo);

  setTimeout(() => {
    finishQuestionAll(roomCode);
  }, GAME_TIMERS.QUESTION_READY + GAME_TIMERS.QUESTION_GUESS);
};

export const answerAllQuestion = (username, answer) => {
  const roomCode = users[username].roomCode;

  if (rooms[roomCode].gameState !== GAME_STATES.ALL_GUESS) return;

  let unique = true;

  rooms[roomCode].currentQuestion.answers.forEach((answer) => {
    if (answer.username === username) unique = false;
  });

  if (!unique) return;

  rooms[roomCode].currentQuestion.answers.push({
    username: username,
    answer: answer,
    time: new Date().getTime(),
  });

  console.log("answerAllQuestion " + username);

  if (rooms[roomCode].currentQuestion.answers.length === 3) {
    finishQuestionAll(roomCode);
  }
};

const finishQuestionAll = async (roomCode) => {
  if (rooms[roomCode].gameState !== GAME_STATES.ALL_GUESS) return;
  rooms[roomCode].gameState = GAME_STATES.ALL_RESULTS;

  const answers = rooms[roomCode].currentQuestion.answers;

  // fill players without answers
  if (answers.length < 3) {
    rooms[roomCode].players.forEach((player) => {
      if (isInAnswers(player, answers)) return;

      answers.push({
        username: player,
        answer: 0,
        time: rooms[roomCode].currentQuestion.endTime,
      });
    });
  }

  answers.forEach((ans) => {
    ans.difference = Math.abs(
      ans.answer - rooms[roomCode].currentQuestion.rightAnswer
    );
  });
  answers.sortByDifferenceTime();
  answers.forEach((ans, idx) => {
    ans.position = idx + 1;
  });

  rooms[roomCode].currentQuestion.answers = shuffleArray(answers);

  console.log("answers: ", rooms[roomCode].currentQuestion.answers);
  console.log("right answer: ", rooms[roomCode].currentQuestion.rightAnswer);

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  rooms[roomCode].pickRegionQueue = [
    answers[0].username,
    answers[0].username,
    answers[1].username,
  ];

  await waitMiliseconds(GAME_TIMERS.QUESTION_RESULTS);

  tryPlayerPickRegion(roomCode);
};

const tryPlayerPickRegion = async (roomCode) => {
  if (rooms[roomCode].pickRegionQueue.length === 0) {
    continueGame(roomCode);
    return;
  }

  rooms[roomCode].gameState = GAME_STATES.PICK_REGION;

  delete rooms[roomCode].currentQuestion;
  rooms[roomCode].currentPick = {
    username: rooms[roomCode].pickRegionQueue.shift(),
    region: null,
  };

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  setTimeout(() => {
    finishPickRegion(roomCode);
  }, GAME_TIMERS.PICK_REGION);
};

export const answerPlayerPickRegion = async (username, region) => {
  const roomCode = users[username].roomCode;

  if (rooms[roomCode].gameState !== GAME_STATES.PICK_REGION) return;
  if (rooms[roomCode].currentPick.username !== username) return;

  rooms[roomCode].currentPick.region = region;

  finishPickRegion(roomCode);
};

const finishPickRegion = async (roomCode) => {
  if (rooms[roomCode].gameState !== GAME_STATES.PICK_REGION) return;

  console.log("finishPickRegion ", rooms[roomCode]);

  let pickValid = false;

  if (rooms[roomCode].currentPick.region) {
    pickValid = isPlayerRegionNeighbor(
      rooms[roomCode].currentPick.username,
      rooms[roomCode].currentPick.region
    );
  }

  if (pickValid) {
    rooms[roomCode].map[rooms[roomCode].currentPick.region].owner =
      rooms[roomCode].currentPick.username;
  } else {
    for (let idx = 0; idx < NUMBER_OF_REGIONS; idx++) {
      if (rooms[roomCode].map[idx].owner !== null) continue;
      if (!isPlayerRegionNeighbor(rooms[roomCode].currentPick.username, idx))
        continue;

      rooms[roomCode].map[idx].owner = rooms[roomCode].currentPick.username;
      break;
    }
  }

  delete rooms[roomCode].currentPick;
  rooms[roomCode].gameState = GAME_STATES.PICK_REGION_RESULTS;

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.PICK_REGION_AFTER);

  tryPlayerPickRegion(roomCode);
};

const continueGame = async (roomCode) => {
  console.log("continueGame " + roomCode);
  console.log(rooms[roomCode]);
};
