// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import StartPage from "./pages/Start_Page.jsx";
import GameLobby from "./pages/Game_Lobby.jsx";
import GameActive from "./pages/Game_Active.jsx";
import ResultPage from "./pages/Result_Page.jsx"; // ✅ add

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/lobby/:roomId" element={<GameLobby />} />
      <Route path="/active/:roomId" element={<GameActive />} />
      <Route path="/result/:roomId" element={<ResultPage />} /> {/* ✅ add */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
