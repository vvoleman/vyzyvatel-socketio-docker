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
  PICK_REGION: "region pick", // who is picking, end time
  ATTACK_REGION: "region pick",

  ALL_RESULTS: "all_results", // player answers, winner, second winner
  ALL_GUESS: "all_guess", // playerAnswers, start time, end time

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
  READY: 5 * 1000,
  GUESS: 10 * 1000,
};
