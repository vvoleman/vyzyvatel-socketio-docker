import {
  QUESTION_TYPES,
  GAME_REGION_NEIGHBORS,
  NUMBER_OF_REGIONS,
} from "../constants.js";
import { users, rooms, questionSets } from "../globals.js";
import { shuffleArray } from "../utils/universalUtils.js";

export const hasAnyAviableNeighbor = (username) => {
  const roomCode = users[username].roomCode;

  for (let idx = 0; idx < NUMBER_OF_REGIONS; idx++) {
    if (
      isPlayerRegionNeighbor(username, idx) &&
      rooms[roomCode].map[idx].owner === null
    )
      return true;
  }
  return false;
};

export const numberOfAviableRegions = (roomCode) => {
  let count = 0;
  for (let idx = 0; idx < NUMBER_OF_REGIONS; idx++) {
    if (rooms[roomCode].map[idx].owner === null) count++;
  }
  return count;
};

export const isPlayerRegionNeighbor = (username, regionIdx) => {
  const roomCode = users[username].roomCode;

  const playerRegions = [];

  for (let idx = 0; idx < NUMBER_OF_REGIONS; idx++) {
    if (rooms[roomCode].map[idx].owner !== username) continue;
    if (playerRegions.includes(idx)) continue;

    playerRegions.push(idx);
  }

  if (playerRegions.length === 0) { // player has no regions
    playerRegions.push(14);
  }

  return GAME_REGION_NEIGHBORS[regionIdx].some((regIdx) =>
    playerRegions.includes(regIdx)
  );
};

export const pickPlayerColors = (players) => {
  const shuffledPlayers = shuffleArray(players);
  const playerColors = {};

  playerColors[shuffledPlayers[0]] = 0;
  playerColors[shuffledPlayers[1]] = 1;
  playerColors[shuffledPlayers[2]] = 2;

  return playerColors;
};

export const setCurrentQuestion = (roomCode, questionType) => {
  let currentQuestion = null;

  switch (questionType) {
    case QUESTION_TYPES.PICK:
      currentQuestion = questionSets[roomCode].pickQuestions.pop();

      currentQuestion.wrong_answers.push(currentQuestion.right_answer);
      currentQuestion = {
        id: currentQuestion.id,
        question: currentQuestion.question,
        possibleAnswers: shuffleArray(currentQuestion.wrong_answers),
        type: QUESTION_TYPES.PICK,

        rightAnswer: currentQuestion.right_answer,
      };
      break;

    case QUESTION_TYPES.NUMERIC:
      currentQuestion = questionSets[roomCode].numericQuestions.pop();

      currentQuestion = {
        id: currentQuestion.id,
        question: currentQuestion.question,
        type: QUESTION_TYPES.NUMERIC,

        rightAnswer: currentQuestion.right_answer,
      };
      break;

    case QUESTION_TYPES.IMAGE:
      currentQuestion = questionSets[roomCode].imageQuestions.pop();

      currentQuestion.wrong_answers.push(currentQuestion.right_answer);
      currentQuestion = {
        id: currentQuestion.id,
        question: currentQuestion.question,
        image_url: currentQuestion.image_url,
        possibleAnswers: shuffleArray(currentQuestion.wrong_answers),
        type: QUESTION_TYPES.IMAGE,

        rightAnswer: currentQuestion.right_answer,
      };
      break;

    default:
      return;
  }

  rooms[roomCode].currentQuestion = currentQuestion;
};

export const isInAnswers = (username, answers) => {
  if (answers.length === 0) {
    return false;
  }
  for (const answer of answers) {
    if (username === answer.username) {
      return true;
    }
  }
  return false;
};
