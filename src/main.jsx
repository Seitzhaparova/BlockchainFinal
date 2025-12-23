import React from "react";
import ReactDOM from "react-dom/client";
// import StartPage from "./pages/Start_Page.jsx"
import GameLobby from "./pages/Game_Lobby.jsx";
import "./main_page.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GameLobby />
  </React.StrictMode>
);
