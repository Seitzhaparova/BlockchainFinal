import React, { useState } from "react";
import "../App.css";
import Character from "../components/Character";
import ClothingSelector from "../components/ClothingSelector";
import mannequinImage from "../assets/characters/mannequin.png";

// Импорты одежды
import dress1 from "../assets/clothes/dress1.png";
import hat1 from "../assets/clothes/hat1.png";
import shoes1 from "../assets/clothes/shoes1.png";
import necklace from "../assets/clothes/necklace.png";

function GamePage({ roomId, onExit }) {
  const [selectedClothes, setSelectedClothes] = useState([]);
  const [gameStatus, setGameStatus] = useState("Выбирайте одежду");
  
  // Данные одежды
  const clothingItems = [
    { id: 'dress1', name: 'Neon Dress', image: dress1, type: 'dress' },
    { id: 'hat1', name: 'Glam Hat', image: hat1, type: 'hat' },
    { id: 'shoes1', name: 'Sparkle Shoes', image: shoes1, type: 'shoes' },
    { id: 'necklace', name: 'Crystal Necklace', image: necklace, type: 'accessory' },
  ];

  // Получаем выбранные элементы одежды
  const selectedClothingData = clothingItems.filter(item => 
    selectedClothes.includes(item.id)
  );

  function toggleClothing(itemId) {
    setSelectedClothes(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  }

  function submitLook() {
    setGameStatus("Образ отправлен на голосование!");
    // Здесь будет логика отправки образа
  }

  function voteForLook() {
    setGameStatus("Ваш голос учтен!");
    // Здесь будет логика голосования
  }

  return (
    <div className="game-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      <header className="game-header">
        <div className="brand">
          <span className="brand-mark">★</span>
          <span className="brand-name">DressChain</span>
        </div>
        
        <div className="game-info">
          <div className="room-info">
            <span className="info-label">Комната:</span>
            <span className="info-value">{roomId || "123456"}</span>
          </div>
          <div className="game-status">
            <span className="status-label">Статус:</span>
            <span className="status-value">{gameStatus}</span>
          </div>
          <button className="btn small outline" onClick={onExit}>
            Выйти
          </button>
        </div>
      </header>

      <main className="game-main">
        <div className="game-left">
          <div className="game-card">
            <h2 className="game-title">Игровая комната</h2>
            <p className="game-subtitle">
              Тема недели: <strong>Neon Glam</strong>
            </p>
            
            <div className="game-timer">
              <span className="timer-label">До конца голосования:</span>
              <span className="timer-value">05:43</span>
            </div>
            
            <div className="game-actions">
              <button className="btn primary" onClick={submitLook}>
                Отправить образ
              </button>
              <button className="btn outline" onClick={voteForLook}>
                Проголосовать
              </button>
            </div>
            
            <div className="players-list">
              <h4>Игроки в комнате:</h4>
              <ul>
                <li>👑 Вы (создатель)</li>
                <li>👗 Anna</li>
                <li>👒 Maria</li>
                <li>👠 Sofia</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="game-right">
          <div className="dressing-area">
            <div className="dressing-header">
              <h3>Твой манекен</h3>
              <div className="theme-badge">Neon Glam</div>
            </div>
            
            {/* Здесь манекен для игры */}
            <Character
              baseImage={mannequinImage}
              clothes={selectedClothingData}
              width={320}
              height={500}
              className="game-mannequin"
            />
            
            <div className="clothing-panel">
              <ClothingSelector
                items={clothingItems}
                selectedItems={selectedClothes}
                onSelectItem={toggleClothing}
                columns={4}
              />
            </div>
            
            <div className="look-score">
              <div className="score-item">
                <span className="score-label">Текущий счет:</span>
                <span className="score-value">850 очков</span>
              </div>
              <div className="score-item">
                <span className="score-label">Токены:</span>
                <span className="score-value">120 DRESS</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GamePage;