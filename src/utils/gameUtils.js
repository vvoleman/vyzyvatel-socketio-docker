import {
  QUESTION_TYPES,
  USER_STATES,
  ROOM_STATES,
  GAME_STATES,
  PLAYER_COLORS,
  GAME_TIMERS,
} from "../constants.js";
import { users, rooms, questionSets } from "../globals.js";
import { getQuestionSet } from "../getRequests.js";
import { shuffleArray } from "./universalUtils.js";
import { defaultMapInfo } from "../defaults.js";
import { io } from "../../index.js";

const pickPlayerColors = (players) => {
  let i = 1;
  while (players.length < 3) {
    let name = "Tester_" + i;
    players.push(name);
    i++;
  }
  const shuffledPlayers = shuffleArray(players);
  const playerColors = {};

  playerColors[shuffledPlayers[0]] = PLAYER_COLORS.RED;
  playerColors[shuffledPlayers[1]] = PLAYER_COLORS.GREEN;
  playerColors[shuffledPlayers[2]] = PLAYER_COLORS.BLUE;

  return playerColors;
};

export const setCurrentQuestion = (roomCode, questionType) => {
  let currentQuestion = null;

  switch (questionType) {
    case QUESTION_TYPES.PICK:
      currentQuestion = questionSets[roomCode].pickQuestions.pop();
      currentQuestion.wrong_answers.push(currentQuestion.right_answer);
      currentQuestion = {
        question: currentQuestion.question,
        possibleAnswers: shuffleArray(currentQuestion.wrong_answers),
        type: QUESTION_TYPES.PICK,
      };
      break;

    case QUESTION_TYPES.NUMERIC:
      currentQuestion = questionSets[roomCode].numericQuestions.pop();
      currentQuestion = {
        question: currentQuestion.question,
        type: QUESTION_TYPES.NUMERIC,
      };
      break;

    case QUESTION_TYPES.IMAGE:
      currentQuestion = questionSets[roomCode].imageQuestions.pop();
      currentQuestion.wrong_answers.push(currentQuestion.right_answer);
      currentQuestion = {
        question: currentQuestion.question,
        image_url: currentQuestion.image_url,
        possibleAnswers: shuffleArray(currentQuestion.wrong_answers),
        type: QUESTION_TYPES.IMAGE,
      };
      break;

    default:
      return;
  }

  rooms[roomCode].currentQuestion = currentQuestion;
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

  askQuestionAll(roomCode);
};

const askQuestionAll = (roomCode) => {
  console.log("askQuestionAll " + roomCode);

  setCurrentQuestion(roomCode, QUESTION_TYPES.NUMERIC);

  rooms[roomCode] = {
    ...rooms[roomCode],
    gameState: GAME_STATES.ALL_GUESS,
    gameStateProps: {
      startTime: new Date().getTime() + GAME_TIMERS.READY,
      endTime: new Date().getTime() + GAME_TIMERS.READY + GAME_TIMERS.GUESS,
    },
  };

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  setTimeout(() => {
    finishQuestionAll(roomCode);
  }, GAME_TIMERS.READY + GAME_TIMERS.GUESS);
};

const finishQuestionAll = (roomCode) => {
  console.log("finish");
};
