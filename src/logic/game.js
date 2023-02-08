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
  DEFENDER_PRICE_BONUS,
} from "../constants.js";
import { users, rooms, questionSets } from "../globals.js";
import { getQuestionSet } from "../getRequests.js";
import {
  shuffleArray,
  deepCopy,
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
import { updateUserLastActivity } from "./users.js";

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
  if (rooms[roomCode].players.length !== 3) return;

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
    pickRegionHistory: [],
    startTime: new Date().getTime(),
    endTime: new Date().getTime() + GAME_TIMERS.START,
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

  setNextGameState(roomCode);
};

// WARNING: indentation hell
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
          switch (rooms[roomCode].currentQuestion.type) {
            case QUESTION_TYPES.IMAGE: // img and pick have same logic
            case QUESTION_TYPES.PICK:
              const question = rooms[roomCode].currentQuestion;

              let correctAnswers = 0;
              let winner = null;

              question.answers.forEach((answer) => {
                if (answer.correct) {
                  correctAnswers++;
                  winner = answer.username;
                }
              });

              if (correctAnswers === 0) {
                finishBattle(roomCode, null);
                return;
              }

              if (correctAnswers === 1) {
                finishBattle(roomCode, winner);
                return;
              }

              if (correctAnswers > 1) {
                askQuestion(
                  roomCode,
                  question.involvedPlayers,
                  QUESTION_TYPES.NUMERIC
                );
                return;
              }
              return;

            case QUESTION_TYPES.NUMERIC:
              finishBattle(
                roomCode,
                rooms[roomCode].currentQuestion.answers[0].username
              );
              return;
          }
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
            return;
          }
          if (rooms[roomCode].attackRegionQueue.length > 0) {
            attackRegion(roomCode);
            return;
          }
          endGame(roomCode);
          return;
      }
      return;
  }
};

const askQuestion = (roomCode, involvedPlayers, questionType) => {
  setCurrentQuestion(roomCode, questionType);

  rooms[roomCode] = {
    ...rooms[roomCode],
    gameState: GAME_STATES.QUESTION_GUESS,
    startTime: new Date().getTime() + GAME_TIMERS.QUESTION_READY,
    endTime:
      new Date().getTime() +
      GAME_TIMERS.QUESTION_READY +
      GAME_TIMERS.QUESTION_GUESS,
    currentQuestion: {
      ...rooms[roomCode].currentQuestion,
      answers: [],
      involvedPlayers: involvedPlayers,
    },
  };

  const clientRoomInfo = deepCopy(rooms[roomCode]);
  delete clientRoomInfo.currentQuestion.rightAnswer;
  delete clientRoomInfo.currentQuestion.answers;

  io.to(roomCode).emit("room-update", clientRoomInfo);

  setTimeout(() => {
    try {
      finishQuestion(
        roomCode,
        clientRoomInfo.currentQuestion.id,
        clientRoomInfo.currentQuestion.type
      ); // id must be value not reference (deepCopy)
    } catch (e) {
      console.log(e);
    }
  }, GAME_TIMERS.QUESTION_READY + GAME_TIMERS.QUESTION_GUESS + GAME_TIMERS.QUESTION_EVALUALTION);
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
      ? GAME_TIMERS.QUESTION_GUESS
      : new Date().getTime() - rooms[roomCode].startTime,
  });

  // all involvedPlayers answered
  if (
    rooms[roomCode].currentQuestion.answers.length ===
    rooms[roomCode].currentQuestion.involvedPlayers.length
  ) {
    finishQuestion(
      roomCode,
      rooms[roomCode].currentQuestion.id,
      rooms[roomCode].currentQuestion.type
    );
  }
};

const finishQuestion = async (roomCode, questionId, questionType) => {
  if (rooms[roomCode].gameState !== GAME_STATES.QUESTION_GUESS) return;
  if (rooms[roomCode].currentQuestion.id !== questionId) return;
  if (rooms[roomCode].currentQuestion.type !== questionType) return;

  const answers = rooms[roomCode].currentQuestion.answers;

  // generate answer for players that did not answer
  if (answers.length < rooms[roomCode].currentQuestion.involvedPlayers.length) {
    rooms[roomCode].currentQuestion.involvedPlayers.forEach((player) => {
      if (!isInAnswers(player, answers)) {
        switch (rooms[roomCode].currentQuestion.type) {
          case QUESTION_TYPES.NUMERIC:
            answers.push({
              username: player,
              answer: 0,
              time: GAME_TIMERS.QUESTION_GUESS,
            });
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

    case QUESTION_TYPES.IMAGE:
    case QUESTION_TYPES.PICK:
      answers.forEach((ans) => {
        ans.correct =
          ans.answer === rooms[roomCode].currentQuestion.rightAnswer;
      });
      break;
  }

  rooms[roomCode].gameState = GAME_STATES.QUESTION_RESULTS;
  rooms[roomCode].startTime = new Date().getTime();
  rooms[roomCode].endTime = new Date().getTime() + GAME_TIMERS.QUESTION_RESULTS;

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.QUESTION_RESULTS);

  setNextGameState(roomCode);
};

const pickRegion = async (roomCode) => {
  rooms[roomCode].gameState = GAME_STATES.REGION_PICK;

  const username = rooms[roomCode].pickRegionQueue.shift();
  const pickId = numberOfAviableRegions(roomCode);

  delete rooms[roomCode].currentQuestion;

  rooms[roomCode].startTime = new Date().getTime();
  rooms[roomCode].endTime = new Date().getTime() + GAME_TIMERS.REGION_PICK;
  rooms[roomCode].currentPick = {
    id: pickId,
    username: username,
    region: null,
    onlyNeighbors: hasAnyAviableNeighbor(username),
  };

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  setTimeout(() => {
    try {
      finishPickRegion(roomCode, pickId);
    } catch (e) {
      console.log(e);
    }
  }, GAME_TIMERS.REGION_PICK);
};

export const answerPickRegion = async (username, region) => {
  const roomCode = users[username].roomCode;

  if (rooms[roomCode].gameState !== GAME_STATES.REGION_PICK) return;
  if (rooms[roomCode].currentPick.username !== username) return;

  rooms[roomCode].currentPick.region = region;

  finishPickRegion(roomCode, rooms[roomCode].currentPick.id);
};

const finishPickRegion = async (roomCode, pickId) => {
  if (rooms[roomCode].gameState !== GAME_STATES.REGION_PICK) return;
  if (rooms[roomCode].currentPick.id !== pickId) return;

  rooms[roomCode].gameState = GAME_STATES.REGION_RESULTS;

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

  await waitMiliseconds(GAME_TIMERS.REGION_RESULTS);

  setNextGameState(roomCode);
};

const allRegionsTaken = async (roomCode) => {
  rooms[roomCode].gameStage = GAME_STAGES.BATTLE_REGIONS;

  delete rooms[roomCode].pickRegionQueue;
  delete rooms[roomCode].pickRegionHistory;

  rooms[roomCode].attackRegionQueue = [];
  rooms[roomCode].attackRegionHistory = [];

  for (let i = 0; i < NUMBER_OF_ROUNDS; i++) {
    rooms[roomCode].attackRegionQueue = rooms[
      roomCode
    ].attackRegionQueue.concat(shuffleArray(rooms[roomCode].players));
  }

  setNextGameState(roomCode);
};

const attackRegion = async (roomCode) => {
  rooms[roomCode].gameState = GAME_STATES.REGION_ATTACK;

  const attacker = rooms[roomCode].attackRegionQueue.shift();
  const attackId = rooms[roomCode].attackRegionQueue.length;

  rooms[roomCode].startTime = new Date().getTime();
  rooms[roomCode].endTime = new Date().getTime() + GAME_TIMERS.REGION_ATTACK;
  rooms[roomCode].currentAttack = {
    id: attackId,
    attacker: attacker,
    defender: null,
    region: null,
  };

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  setTimeout(() => {
    try {
      finishAttackRegion(roomCode, attackId);
    } catch (e) {
      console.log(e);
    }
  }, GAME_TIMERS.REGION_ATTACK);
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

  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.REGION_RESULTS);

  setNextGameState(roomCode);
};

const finishBattle = async (roomCode, winner) => {
  if (winner === null) {
  } else if (winner === rooms[roomCode].currentAttack.defender) {
    rooms[roomCode].map[rooms[roomCode].currentAttack.region].price +=
      DEFENDER_PRICE_BONUS;
  } else {
    rooms[roomCode].map[rooms[roomCode].currentAttack.region].owner = winner;
  }
  delete rooms[roomCode].currentAttack;
  delete rooms[roomCode].currentQuestion;

  rooms[roomCode].gameState = GAME_STATES.REGION_RESULTS;
  rooms[roomCode].startTime = new Date().getTime();
  rooms[roomCode].endTime = new Date().getTime() + GAME_TIMERS.BATTLE_FINISH;

  rooms[roomCode].attackRegionHistory.push(winner);

  await waitMiliseconds(GAME_TIMERS.BATTLE_FINISH);

  setNextGameState(roomCode);
};

const endGame = async (roomCode) => {
  rooms[roomCode].gameState = GAME_STATES.REGION_RESULTS;
  io.to(roomCode).emit("room-update", rooms[roomCode]);

  await waitMiliseconds(GAME_TIMERS.REGION_RESULTS);

  rooms[roomCode].state = ROOM_STATES.ENDED;
  rooms[roomCode].roomCode = roomCode;
  io.to(roomCode).emit("room-update", rooms[roomCode]);

  rooms[roomCode].players.forEach((player) => {
    try {
      if (io.sockets.sockets.get(users[player].socket))
        io.sockets.sockets.get(users[player].socket).leave(roomCode);
    } catch (e) {
      console.log(e);
    }
    users[player] = {
      ...users[player],
      state: USER_STATES.MENU,
      roomCode: null,
    };
    updateUserLastActivity(player);
  });

  delete rooms[roomCode];
  delete questionSets[roomCode];
};
