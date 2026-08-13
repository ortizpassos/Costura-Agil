let io = null;

function setIO(socketIO) {
  io = socketIO;
}

function roomForHardware(deviceId) {
  return `hardware:${String(deviceId || '').trim().toUpperCase()}`;
}

function emitToHardware(deviceId, eventName, payload) {
  if (!io) return false;

  io.to(roomForHardware(deviceId)).emit(
    eventName,
    payload
  );

  return true;
}

module.exports = {
  setIO,
  roomForHardware,
  emitToHardware
};
