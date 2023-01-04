import { DEBUG } from "../constants.js";

export const shuffleArray = (refArray) => {
  const array = [...refArray];
  let currentIndex = array.length,
    randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
};

export const arrayRemove = (arr, value) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === value) {
      arr.splice(i, 1);
      i--;
    }
  }
};

export const debugLog = (message) => {
  if (DEBUG) console.log(message);
};

export const deepCopyDict = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  let copy;
  if (Array.isArray(obj)) {
    copy = [];
    for (let i = 0; i < obj.length; i++) {
      copy[i] = deepCopyDict(obj[i]);
    }
  } else {
    copy = {};
    for (const key in obj) {
      copy[key] = deepCopyDict(obj[key]);
    }
  }

  return copy;
};

export const waitMiliseconds = async (miliseconds) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, miliseconds);
  });
};
