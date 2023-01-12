import {
  QUESTION_TYPES,
  USER_STATES,
  ROOM_STATES,
  GAME_STATES,
  GAME_TIMERS,
  NUMBER_OF_REGIONS,
  NUMBER_OF_ROUNDS,
  IMAGE_QUESTION_CHANCE,
  GAME_STAGES,
} from "../constants.js";
import { users, rooms } from "../globals.js";
import { getQuestionSet } from "../getRequests.js";
import {
  shuffleArray,
  deepCopyDict,
  waitMiliseconds,
  getTrueOrFalseByChance,
} from "../utils/universalUtils.js";
import { defaultMapInfo } from "../defaults.js";
import { io } from "../../index.js";
import {
  isInAnswers,
  pickPlayerColors,
  setCurrentQuestion,
  isPlayerRegionNeighbor,
  numberOfAviableRegions,
  hasAnyAviableNeighbor,
} from "../utils/gameUtils.js";

var SPEED_RUN_MODE = 0.05;

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
    gameStage: GAME_STAGES.TAKE_REGIONS,
    map: defaultMapInfo(),
    playerColors: pickPlayerColors(rooms[roomCode].players),
    started: new Date(Date.now()),
    pickRegionHistory: [],
    startTime: new Date().getTime(),
    endTime: new Date().getTime() + GAME_TIMERS.START * SPEED_RUN_MODE,
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

  await waitMiliseconds(GAME_TIMERS.START * SPEED_RUN_MODE);

  setNextGameState(roomCode);
};

const setNextGameState = async (roomCode) => {
  switch (rooms[roomCode].gameState) {
    case GAME_STATES.START:
      askQuestion(roomCode, rooms[roomCode].players, QUESTION_TYPES.NUMERIC);
      return;

    case GAME_STATES.QUESTION_RESULTS:
      switch (rooms[roomCode].gameStage) {
        case GAME_STAGES.TAKE_REGIONS:
          rooms[roomCode].pickRegionQueue = [];

          const aviableRegions = numberOfAviableRegions(roomCode);
          const answers = rooms[roomCode].currentQuestion.answers;
          console.log("answers", answers);

          if (aviableRegions === 2) {
            rooms[roomCode].pickRegionQueue.push(answers[0].username);
            rooms[roomCode].pickRegionQueue.push(answers[1].username);
          } else {
            if (aviableRegions > 0) {
              rooms[roomCode].pickRegionQueue.push(answers[0].username);
            }
            if (aviableRegions > 1) {
              rooms[roomCode].pickRegionQueue.push(answers[0].username);
            }
            if (aviableRegions > 2) {
              rooms[roomCode].pickRegionQueue.push(answers[1].username);
            }
          }

          pickRegion(roomCode);
          return;

        case GAME_STAGES.BATTLE_REGIONS:
          return;
      }
      return;

    case GAME_STATES.REGION_RESULTS:
      switch (rooms[roomCode].gameStage) {
        case GAME_STAGES.TAKE_REGIONS:
          if (rooms[roomCode].pickRegionQueue.length > 0) {
            pickRegion(roomCode);
            return;
          }
          if (numberOfAviableRegions(roomCode) > 0) {
            askQuestion(
              roomCode,
              rooms[roomCode].players,
              QUESTION_TYPES.NUMERIC
            );
            return;
          }

          allRegionsTaken(roomCode);
          return;

        case GAME_STAGES.BATTLE_REGIONS:
          if (rooms[roomCode].currentAttack) {
            askQuestion(
              roomCode,
              [
                rooms[roomCode].currentAttack.attacker,
                rooms[roomCode].currentAttack.defender,
              ],
              getTrueOrFalseByChance(IMAGE_QUESTION_CHANCE)
                ? QUESTION_TYPES.IMAGE
                : QUESTION_TYPES.PICK
            );
          }
          if (rooms[roomCode].attackRegionQueue.length > 0) {
            attackRegion(roomCode);
            return;
          }
          return;
      }
  }
};

const askQuestion = (roomCode, involvedPlayers, questionType) => {
  setCurrentQuestion(roomCode, questionType);

  rooms[roomCode] = {
    ...rooms[roomCode],
    gameState: GAME_STATES.QUESTION_GUESS,
    startTime:
      new Date().getTime() + GAME_TIMERS.QUESTION_READY * SPEED_RUN_MODE,
    endTime:
      new Date().getTime() +
      GAME_TIMERS.QUESTION_READY * SPEED_RUN_MODE +
      GAME_TIMERS.QUESTION_GUESS * SPEED_RUN_MODE,
    currentQuestion: {
      ...rooms[roomCode].currentQuestion,
      answers: [],
      involvedPlayers: involvedPlayers,
    },
  };

  const clientRoomInfo = deepCopyDict(rooms[roomCode]);
  delete clientRoomInfo.currentQuestion.rightAnswer;
  delete clientRoomInfo.currentQuestion.answers;

  console.log(
    "askQuestion " + roomCode,
    involvedPlayers,
    questionType,
    rooms[roomCode]
  );

  io.to(roomCode).emit("room-update", clientRoomInfo);

  setTimeout(() => {
    finishQuestion(roomCode, rooms[roomCode].currentQuestion.id);
  }, GAME_TIMERS.QUESTION_READY * SPEED_RUN_MODE + GAME_TIMERS.QUESTION_GUESS * SPEED_RUN_MODE + GAME_TIMERS.QUESTION_EVALUALTION * SPEED_RUN_MODE);
};

export const answerQuestion = (username, answer, auto) => {
  const roomCode = users[username].roomCode;

  if (rooms[roomCode].gameState !== GAME_STATES.QUESTION_GUESS) return;

  for (let i = 0; i < rooms[roomCode].currentQuestion.answers.length; i++) {
    if (rooms[roomCode].currentQuestion.answers[i].username === username) {
      return; // already answered
    }
  }

  rooms[roomCode].currentQuestion.answers.push({
    username: username,
    answer: answer,
    time: auto
      ? rooms[roomCode].endTime
      : new Date().getTime() > rooms[roomCode].endTime
      ? rooms[roomCode].endTime
      : new Date().getTime(),
  });

  console.log("answerQuestion " + username);

  // all involvedPlayers answered
  if (
    rooms[roomCode].currentQuestion.answers.length ===
    rooms[roomCode].currentQuestion.involvedPlayers.length
  ) {
    finishQuestion(roomCode, rooms[roomCode].currentQuestion.id);
  }
};

const finishQuestion = async (roomCode, questionId) => {
  if (rooms[roomCode].gameState !== GAME_STATES.QUESTION_GUESS) return;
  if (rooms[roomCode].currentQuestion.id !== questionId) return;

  rooms[roomCode].gameState = GAME_STATES.QUESTION_RESULTS;

  const answers = rooms[roomCode].currentQuestion.answers;

  // generate answer for players that did not answer
  if (answers.length < rooms[roomCode].currentQuestion.involvedPlayers.length) {
    rooms[roomCode].players.forEach((player) => {
      if (!isInAnswers(player, answers)) {
        switch (rooms[roomCode].currentQuestion.type) {
          case QUESTION_TYPES.NUMERIC:
            // temporary for testing
            if (player.indexOf("testbot") !== -1) {
              answers.push({
                username: player,
                answer: -9999,
                time: rooms[roomCode].endTime,
              });
            } else {
              answers.push({
                username: player,
                answer: 0,
                time: rooms[roomCode].endTime,
              });
            }
            break;
        }
      }
    });
  }

  switch (rooms[roomCode].currentQuestion.type) {
    case QUESTION_TYPES.NUMERIC:
      answers.forEach((ans) => {
        ans.difference = Math.abs(
          ans.answer - rooms[roomCode].currentQuestion.rightAnswer
        );
      });
      answers.sortByDifferenceTime();
      answers.forEach((ans, idx) => {
        ans.position = idx + 1;
      });
      break;
  }
  console.log("finishQuestion", rooms[roomCode]);

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.QUESTION_RESULTS * SPEED_RUN_MODE);

  setNextGameState(roomCode);
};

const pickRegion = async (roomCode) => {
  rooms[roomCode].gameState = GAME_STATES.REGION_PICK;

  const username = rooms[roomCode].pickRegionQueue.shift();
  const pickId = numberOfAviableRegions(roomCode);

  delete rooms[roomCode].currentQuestion;

  rooms[roomCode].startTime = new Date().getTime();
  rooms[roomCode].endTime =
    new Date().getTime() + GAME_TIMERS.REGION_PICK * SPEED_RUN_MODE;
  rooms[roomCode].currentPick = {
    id: pickId,
    username: username,
    region: null,
    onlyNeighbors: hasAnyAviableNeighbor(username),
  };

  console.log("pickRegion", rooms[roomCode]);

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  setTimeout(() => {
    finishPickRegion(roomCode, pickId);
  }, GAME_TIMERS.REGION_PICK * SPEED_RUN_MODE);
};

export const answerPickRegion = async (username, region) => {
  const roomCode = users[username].roomCode;

  console.log("answerPickRegion", username, region, rooms[roomCode]);

  if (rooms[roomCode].gameState !== GAME_STATES.REGION_PICK) return;
  if (rooms[roomCode].currentPick.username !== username) return;

  rooms[roomCode].currentPick.region = region;

  finishPickRegion(roomCode, rooms[roomCode].currentPick.id);
};

const finishPickRegion = async (roomCode, pickId) => {
  if (rooms[roomCode].gameState !== GAME_STATES.REGION_PICK) return;
  if (rooms[roomCode].currentPick.id !== pickId) return;

  rooms[roomCode].gameState = GAME_STATES.REGION_RESULTS;

  console.log("finishPickRegion ", rooms[roomCode]);

  let pickValid = false;

  if (rooms[roomCode].currentPick.region) {
    pickValid =
      isPlayerRegionNeighbor(
        rooms[roomCode].currentPick.username,
        rooms[roomCode].currentPick.region
      ) || !rooms[roomCode].currentPick.onlyNeighbors;
  }

  if (pickValid) {
    rooms[roomCode].map[rooms[roomCode].currentPick.region].owner =
      rooms[roomCode].currentPick.username;
  } else {
    for (let idx = 0; idx < NUMBER_OF_REGIONS; idx++) {
      if (rooms[roomCode].map[idx].owner !== null) continue;
      if (
        !isPlayerRegionNeighbor(rooms[roomCode].currentPick.username, idx) &&
        rooms[roomCode].currentPick.onlyNeighbors
      )
        continue;

      rooms[roomCode].map[idx].owner = rooms[roomCode].currentPick.username;
      break;
    }
  }

  rooms[roomCode].pickRegionHistory.push(rooms[roomCode].currentPick.username);

  delete rooms[roomCode].currentPick;

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.REGION_RESULTS * SPEED_RUN_MODE);

  setNextGameState(roomCode);
};

const allRegionsTaken = async (roomCode) => {
  rooms[roomCode].gameStage = GAME_STAGES.BATTLE_REGIONS;

  // temporary for testing
  SPEED_RUN_MODE = 1;

  delete rooms[roomCode].pickRegionQueue;
  delete rooms[roomCode].pickRegionHistory;

  rooms[roomCode].attackRegionQueue = [];
  rooms[roomCode].attackRegionHistory = [];

  for (let i = 0; i < NUMBER_OF_ROUNDS; i++) {
    rooms[roomCode].attackRegionQueue = rooms[
      roomCode
    ].attackRegionQueue.concat(shuffleArray(rooms[roomCode].players));
  }

  // temporary for testing
  rooms[roomCode].attackRegionQueue = rooms[roomCode].attackRegionQueue.filter(
    (str) => !str.includes("testbot_")
  );

  console.log("allRegionsTaken " + roomCode);
  console.log(rooms[roomCode]);

  setNextGameState(roomCode);
};

const attackRegion = async (roomCode) => {
  rooms[roomCode].gameState = GAME_STATES.REGION_ATTACK;

  const attacker = rooms[roomCode].attackRegionQueue.shift();
  const attackId = rooms[roomCode].attackRegionQueue.length;

  rooms[roomCode].startTime = new Date().getTime();
  rooms[roomCode].endTime =
    new Date().getTime() + GAME_TIMERS.REGION_ATTACK * SPEED_RUN_MODE;
  rooms[roomCode].currentAttack = {
    id: attackId,
    attacker: attacker,
    defender: null,
    region: null,
  };

  console.log("attackRegion", rooms[roomCode]);

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  setTimeout(() => {
    finishAttackRegion(roomCode, attackId);
  }, GAME_TIMERS.REGION_ATTACK * SPEED_RUN_MODE);
};

export const answerAttackRegion = async (username, region) => {
  const roomCode = users[username].roomCode;

  if (rooms[roomCode].gameState !== GAME_STATES.REGION_ATTACK) return;
  if (rooms[roomCode].currentAttack.attacker !== username) return;

  rooms[roomCode].currentAttack.region = region;

  finishAttackRegion(roomCode, rooms[roomCode].currentAttack.id);
};

const finishAttackRegion = async (roomCode, attackId) => {
  if (rooms[roomCode].gameState !== GAME_STATES.REGION_ATTACK) return;
  if (rooms[roomCode].currentAttack.id !== attackId) return;

  rooms[roomCode].gameState = GAME_STATES.REGION_RESULTS;

  let attackValid = false;

  if (rooms[roomCode].currentAttack.region) {
    attackValid =
      isPlayerRegionNeighbor(
        rooms[roomCode].currentAttack.attacker,
        rooms[roomCode].currentAttack.region
      ) &&
      rooms[roomCode].map[rooms[roomCode].currentAttack.region].owner !==
        rooms[roomCode].currentAttack.attacker;
  }

  if (attackValid) {
    rooms[roomCode].currentAttack.defender =
      rooms[roomCode].map[rooms[roomCode].currentAttack.region].owner;
  } else {
    for (let idx = 0; idx < NUMBER_OF_REGIONS; idx++) {
      // temporary for testing
      if (rooms[roomCode].map[idx].owner.includes("testbot_")) continue;

      if (
        rooms[roomCode].map[idx].owner ===
        rooms[roomCode].currentAttack.attacker
      )
        continue;
      if (!isPlayerRegionNeighbor(rooms[roomCode].currentAttack.attacker, idx))
        continue;

      rooms[roomCode].currentAttack.region = idx;
      rooms[roomCode].currentAttack.defender = rooms[roomCode].map[idx].owner;
      break;
    }
  }

  console.log("finishAttackRegion", rooms[roomCode]);

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.REGION_RESULTS * SPEED_RUN_MODE);

  setNextGameState(roomCode);
};

const endGame = async (roomCode) => {
  console.log("endGame " + roomCode);
};