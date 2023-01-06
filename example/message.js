const randomNumber = require("./randomNumber.js").default;
const person = require("./person.js").default;

exports.a = 1;

module.exports = `something random: ${person.name}-${randomNumber()}`;