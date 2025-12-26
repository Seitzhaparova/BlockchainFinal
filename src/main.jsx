// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ResultPage from "./pages/Result_Page.jsx";
import "./main_page.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ResultPage/>
    </BrowserRouter>
  </React.StrictMode>
);
