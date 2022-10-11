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

export const arrayRemove = (arr, value) => {
  return arr.filter(function (ele) {
    return ele != value;
  });
};
