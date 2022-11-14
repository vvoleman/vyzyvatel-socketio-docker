import { PLAYER_COLORS } from "./constants.js";

export const generateCode = (len, rooms) => {
  const characters = "123456789ABCDEFGHJKLMNPRSTUXYZ";

  let isUnique = false;
  while (!isUnique) {
    var code = "";
    for (let i = 0; i < len; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    if (!(code in rooms)) isUnique = true;
  }

  return code;
};

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
  return arr.filter(function (ele) {
    return ele != value;
  });
};

export const pickPlayerColors = (players) => {
  const pla = players; // [...players]
  let i = 1;
  while (pla.length < 3) {
    let name = "tester" + i;
    pla.push(name);
    i++;
  }
  const shufflePlayers = shuffleArray(pla);
  const dict = {};

  dict[shufflePlayers[0]] = PLAYER_COLORS.RED;
  dict[shufflePlayers[1]] = PLAYER_COLORS.GREEN;
  dict[shufflePlayers[2]] = PLAYER_COLORS.BLUE;

  return dict;
};
