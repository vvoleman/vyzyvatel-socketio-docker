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

  PICK_REGION: "region_pick", // who is picking, end time
  ATTACK_REGION: "region_pick",

  ALL_GUESS: "all_guess", // playerAnswers, start time, end time
  ALL_RESULTS: "all_results", // player answers, winner, second winner

  ATTACK_GUESS: "attack_guess", // involvedPlayers, playerAnswers, start time, end time
  ATTACK_RESULTS: "attack_results", // involvedPlayers, playerAnswers, start time, end time
};

export const QUESTION_TYPES = {
  PICK: "pick",
  NUMERIC: "numeric",
  IMAGE: "image",
};

export const PLAYER_COLORS = {
  RED: "#FF4545",
  GREEN: "#52FF68",
  BLUE: "#4EBAFF",
};

export const BACKEND_URL = "http://127.0.0.1:8000";

export const GAME_TIMERS = {
  START: 5 * 1000,
  QUESTION_READY: 3.5 * 1000,
  QUESTION_GUESS: 10 * 1000,
  QUESTION_RESULTS: 7 * 1000,
  PICK_REGION: 1 * 1000,
  PICK_REGION_AFTER: 3 * 1000,
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
