export const METHODS = {
  // WRITE
  createGame: "createGame",   // payable create
  joinGame: "joinGame",       // payable join(gameId)
  startGame: "startGame",     // start(gameId)
  vote: "vote",               // vote(gameId, targetAddress, stars)
  finalize: "finalizeGame",   // finalize(gameId)
  claim: "claim",             // claim(gameId)

  // READ
  getGame: "getGame"          // getGame(gameId) -> struct
};
