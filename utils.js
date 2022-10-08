module.exports = {
  generateCode,
};

const { DEBUG } = require("./constants");

function generateCode(len, rooms) {
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
}
