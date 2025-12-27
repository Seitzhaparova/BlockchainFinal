// src/App.jsx
import React from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { hasPlayerSubmitted } from "./utils/outfitStorage";

import StartPage from "./pages/Start_Page.jsx";
import GameLobby from "./pages/Game_Lobby.jsx";
import GameActive from "./pages/Game_Active.jsx";
import ResultPage from "./pages/Result_Page.jsx";
import VotingLobby from "./pages/Voting_Lobby.jsx";

// Компонент для защиты маршрута голосования
function ProtectedVotingRoute({ children }) {
  const { roomId } = useParams();
  
  // В будущем здесь будет проверка, что все игроки готовы
  // или время вышло
  
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/lobby/:roomId" element={<GameLobby />} />
      <Route path="/active/:roomId" element={<GameActive />} />
      <Route 
        path="/result/:roomId" 
        element={
          <ProtectedVotingRoute>
            <ResultPage />
          </ProtectedVotingRoute>
        } 
      />
      <Route 
        path="/voting/:roomId" 
        element={
          <ProtectedVotingRoute>
            <VotingLobby />
          </ProtectedVotingRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
