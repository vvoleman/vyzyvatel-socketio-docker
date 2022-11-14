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
  WAIT: "waiting",
  PICK_REGION: "region pick",
  ATTACK_REGION: "region pick",
  SHOW_ANSWERS: "showing answers",
  CHOOSE_ANSWER: "choose answer",
};

export const QUESTION_TYPES = {
  PICK: "pick",
  NUMERIC: "numeric",
};

export const PLAYER_COLORS = {
  RED: "#FF4545",
  GREEN: "#52FF68",
  BLUE: "#4EBAFF",
};

export const BACKEND_URL = "http://127.0.0.1:8000";
