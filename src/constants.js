export const DEBUG = true;

export const USER_STATES = {
  MENU: "v menu",
  LOBBY: "v lobby",
  GAME: "ve hře",
};

export const ROOM_STATES = {
  LOBBY: "lobby",
  GAME: "game",
  ENDED: "ended",
};

export const GAME_STATES = {
  START: "starting",

  REGION_PICK: "region_pick",
  REGION_ATTACK: "region_attack",
  REGION_BATTLE: "region_battle",
  REGION_RESULTS: "region_results",

  QUESTION_GUESS: "question_guess",
  QUESTION_RESULTS: "question_results",
};

export const GAME_STAGES = {
  TAKE_REGIONS: "take_regions",
  BATTLE_REGIONS: "battle_regions",
};

export const QUESTION_TYPES = {
  PICK: "pick",
  NUMERIC: "numeric",
  IMAGE: "image",
};

export const GAME_REGION_NEIGHBORS = {
  0: [6, 1, 8, 9],
  1: [6, 0, 8, 13],
  2: [13, 7, 5, 4, 3],
  3: [2, 4, 12],
  4: [5, 2, 3, 12],
  5: [11, 8, 7, 2, 4],
  6: [1, 0, 8],
  7: [8, 13, 2, 5],
  8: [9, 0, 1, 13, 7, 5, 11, 10],
  9: [0, 8, 11],
  10: [8],
  11: [9, 8, 5],
  12: [4, 3],
  13: [1, 8, 7, 2],
};

export const NUMBER_OF_REGIONS = 14;

export const PLAYER_COLORS = {
  RED: "#FF4545",
  GREEN: "#52FF68",
  BLUE: "#4EBAFF",
};

// ------------ SERVER DEDICATED ------------
export const BACKEND_URL = "http://127.0.0.1:8000";

const speedRun = false;

export const GAME_TIMERS = {
  START: speedRun ? 500 : 6 * 1000, // 6

  QUESTION_READY: speedRun ? 500 : 3 * 1000, // 3
  QUESTION_GUESS: speedRun ? 500 : 6 * 1000, // 6
  QUESTION_RESULTS: speedRun ? 500 : 4 * 1000, // 4
  QUESTION_EVALUALTION: speedRun ? 500 : 1 * 1000, // 1

  REGION_PICK: speedRun ? 500 : 5 * 1000, // 5
  REGION_ATTACK: speedRun ? 500 : 10000 * 1000, // 5
  REGION_RESULTS: speedRun ? 500 : 1.5 * 1000, // 1.5
};

export const NUMBER_OF_ROUNDS = 4;
export const IMAGE_QUESTION_CHANCE = 0.2;
