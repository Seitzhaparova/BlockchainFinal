import React from "react";
import ReactDOM from "react-dom/client";
import StartPage from "./pages/Start_Page.jsx";  // твой файл
import "./main_page.css";                  // твои стили

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StartPage />
  </React.StrictMode>
);
