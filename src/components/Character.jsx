import React from 'react';
import '../App.css';

function Character({ 
  baseImage, 
  clothes = [], 
  width = 300, 
  height = 500,
  className = ""
}) {
  return (
    <div 
      className={`character-container ${className}`}
      style={{ 
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        margin: '0 auto'
      }}
    >
      {/* Базовое изображение персонажа */}
      {baseImage && (
        <img 
          src={baseImage} 
          alt="Character Base" 
          className="character-base"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        />
      )}
      
      {/* Если нет изображений, показываем сообщение */}
      {!baseImage && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.1)',
          borderRadius: '10px',
          color: 'white'
        }}>
          Нет изображения
        </div>
      )}
    </div>
  );
}

export default Character;