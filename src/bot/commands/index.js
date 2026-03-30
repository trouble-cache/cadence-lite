const pingCommand = require("./ping");
const channelIdCommand = require("./channelId");
const userIdCommand = require("./userId");
const timeContextCommand = require("./timeContext");

function loadCommands() {
  return [pingCommand, channelIdCommand, userIdCommand, timeContextCommand];
}

module.exports = {
  loadCommands,
};
