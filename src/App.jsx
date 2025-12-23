import React, { useState } from "react";
import "./App.css";
import StartPage from "./pages/StartPage";
import GamePage from "./pages/GamePage";

function App() {
  const [currentPage, setCurrentPage] = useState("start");
  const [roomId, setRoomId] = useState("");

  function handleJoinGame(joinedRoomId) {
    setRoomId(joinedRoomId);
    setCurrentPage("game");
  }

  function handleCreateGame(createdRoomId) {
    setRoomId(createdRoomId);
    setCurrentPage("game");
  }

  function handleExitGame() {
    setCurrentPage("start");
    setRoomId("");
  }

  return (
    <>
      {currentPage === "start" ? (
        <StartPage
          onJoinGame={handleJoinGame}
          onCreateGame={handleCreateGame}
        />
      ) : (
        <GamePage roomId={roomId} onExit={handleExitGame} />
      )}
    </>
  );
}
export default App;
