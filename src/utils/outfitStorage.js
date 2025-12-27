// src/utils/outfitStorage.js

const STORAGE_KEY = "dresschain_outfits";
const RESULTS_KEY_PREFIX = "dc_results_";
const PLAYER_STATUS_KEY = "dresschain_player_status";
const PLAYER_NAMES_KEY = "dresschain_player_names";

// --- Вспомогательные функции для работы с именами ---

function loadPlayerName(address) {
  if (!address) return "";
  try {
    const stored = localStorage.getItem(PLAYER_NAMES_KEY);
    if (stored) {
      const names = JSON.parse(stored);
      return names[address.toLowerCase()] || "";
    }
  } catch (e) {
    console.error("Error loading player name:", e);
  }
  return "";
}

// --- Базовые функции ---

function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
  }
  if (!localStorage.getItem(PLAYER_STATUS_KEY)) {
    localStorage.setItem(PLAYER_STATUS_KEY, JSON.stringify({}));
  }
}

export function saveOutfit(roomId, playerAddress, outfitData) {
  initStorage();
  const storage = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!storage[roomId]) storage[roomId] = {};

  // Загружаем имя игрока
  const playerName = loadPlayerName(playerAddress);

  // Сохраняем ВСЕ данные аутфита для правильного отображения
  storage[roomId][playerAddress] = {
    ...outfitData,
    playerAddress,
    playerName, // Добавляем имя
    timestamp: Date.now(),
    isReady: true,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));

  // Обновляем статус игрока
  const statusStorage = JSON.parse(localStorage.getItem(PLAYER_STATUS_KEY));
  if (!statusStorage[roomId]) statusStorage[roomId] = {};
  statusStorage[roomId][playerAddress] = {
    hasSubmitted: true,
    submittedAt: Date.now(),
  };
  localStorage.setItem(PLAYER_STATUS_KEY, JSON.stringify(statusStorage));

  console.log("Outfit saved for", playerAddress, outfitData);
}

export function getAllOutfitsInRoom(roomId) {
  initStorage();
  const storage = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const outfits = storage[roomId] || {};

  // Добавляем имена для всех аутфитов
  Object.keys(outfits).forEach((address) => {
    if (!outfits[address].playerName) {
      outfits[address].playerName = loadPlayerName(address);
    }
  });

  return outfits;
}

export function hasPlayerSubmitted(roomId, playerAddress) {
  initStorage();
  const statusStorage = JSON.parse(localStorage.getItem(PLAYER_STATUS_KEY));
  return statusStorage[roomId]?.[playerAddress]?.hasSubmitted || false;
}

// --- Функция генерации ботов с РЕАЛЬНЫМИ аутфитами ---

/**
 * Генерирует 3 бота с РЕАЛЬНЫМИ случайными аутфитами из доступных ассетов
 */
export async function generateTestPlayersWithOutfits(
  roomId,
  hostAddress,
  assets
) {
  initStorage();
  const storage = JSON.parse(localStorage.getItem(STORAGE_KEY));

  // Если в комнате уже есть другие реальные игроки кроме хоста, не добавляем ботов
  const currentPlayers = Object.keys(storage[roomId] || {});
  const realPlayers = currentPlayers.filter(
    (addr) => !addr.startsWith("0xBot")
  );
  if (realPlayers.length > 1) return;

  // Создаем ботов
  const bots = [
    {
      address: "0xBot1A1B2C3D4E5F6",
      name: "FashionBot_1",
      personality: "elegant",
    },
    {
      address: "0xBot2G7H8I9J0K1L2",
      name: "GlitterAI",
      personality: "glam",
    },
    {
      address: "0xBot3M3N4O5P6Q7R8",
      name: "RetroVibe",
      personality: "casual",
    },
  ];

  if (!storage[roomId]) storage[roomId] = {};

  // Функция для получения случайного элемента из массива
  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Генерируем аутфит для каждого бота
  bots.forEach((bot) => {
    // Выбираем случайные элементы в зависимости от "личности" бота

    // 1. Случайное тело
    const body = getRandomItem(assets.bodies).url;

    // 2. Случайные волосы
    const hair = getRandomItem(assets.hairs).url;

    // 3. Случайная обувь
    const shoes = getRandomItem(assets.shoes).url;

    let up = null;
    let down = null;
    let dress = null;
    let hairclips = null;
    let headphones = null;
    let necklace = null;

    // 4. В зависимости от личности выбираем одежду
    if (bot.personality === "elegant") {
      // Элегантный бот - платье
      dress = getRandomItem(assets.dress).url;
      necklace =
        Math.random() > 0.3
          ? getRandomItem(assets.accessories.necklace).url
          : null;
    } else if (bot.personality === "glam") {
      // Глэм бот - верх+низ с аксессуарами
      up = getRandomItem(assets.up).url;
      down = getRandomItem(assets.down).url;
      hairclips =
        Math.random() > 0.4
          ? getRandomItem(assets.accessories.hairclips).url
          : null;
      headphones =
        Math.random() > 0.7
          ? getRandomItem(assets.accessories.headphones).url
          : null;
    } else {
      // Кэжуал бот - верх+низ
      const casualUps = assets.up.filter(
        (item) =>
          !item.label.toLowerCase().includes("shirt 2") &&
          !item.label.toLowerCase().includes("shirt_2")
      );
      const casualDowns = assets.down.filter(
        (item) =>
          item.label.toLowerCase().includes("jeans") ||
          item.label.toLowerCase().includes("skirt")
      );

      up =
        casualUps.length > 0
          ? getRandomItem(casualUps).url
          : getRandomItem(assets.up).url;
      down =
        casualDowns.length > 0
          ? getRandomItem(casualDowns).url
          : getRandomItem(assets.down).url;
    }

    // Сохраняем аутфит бота (ВСЕ данные)
    storage[roomId][bot.address] = {
      playerAddress: bot.address,
      isBot: true,
      name: bot.name,
      playerName: bot.name, // Имя бота
      body,
      hair,
      shoes,
      up,
      down,
      dress,
      hairclips,
      headphones,
      necklace,
      stockings: null,
      socks: null,
      timestamp: Date.now(),
      isReady: true,
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  console.log("Generated 3 bots with real outfits");
}

// --- Подсчет результатов ---

export function calculateAndSaveResults(roomId, userAddress, userRatings) {
  const outfits = getAllOutfitsInRoom(roomId);
  const players = Object.keys(outfits);

  // Структура для подсчета очков
  let scores = {};
  players.forEach((p) => (scores[p] = 0));

  // 1. Добавляем голоса реального юзера
  Object.entries(userRatings).forEach(([targetAddr, rating]) => {
    if (scores[targetAddr] !== undefined) {
      scores[targetAddr] += rating;
    }
  });

  // 2. Боты голосуют (рандомно 3-5 звезд)
  players.forEach((voter) => {
    if (voter === userAddress) return; // Голос юзера уже учтен

    // Бот голосует за всех остальных
    players.forEach((target) => {
      if (voter === target) return; // Сам за себя не голосует

      // Рандомная оценка от 3 до 5
      const randomScore = Math.floor(Math.random() * 3) + 3;
      scores[target] += randomScore;
    });
  });

  // 3. Формируем массив победителей (со ВСЕМИ данными аутфита)
  const ranked = players.map((addr) => {
    const outfit = outfits[addr];
    const name =
      outfit.playerName ||
      outfit.name ||
      (addr.startsWith("0xBot")
        ? "Fashion Bot"
        : loadPlayerName(addr) || "Player");

    return {
      address: addr,
      score: scores[addr],
      outfit: { ...outfit }, // Копируем ВСЕ данные аутфита
      name: name,
      isBot: outfit.isBot || false,
    };
  });

  // Сортировка по убыванию очков
  ranked.sort((a, b) => b.score - a.score);

  // Добавляем ранг
  const winners = ranked.map((p, i) => ({
    ...p,
    rank: i + 1,
  }));

  // 4. Сохраняем в отдельный ключ для Result Page (со ВСЕМИ данными)
  const resultData = {
    roomId,
    calculatedAt: Date.now(),
    winners,
  };

  localStorage.setItem(RESULTS_KEY_PREFIX + roomId, JSON.stringify(resultData));
  console.log("Results saved:", resultData);
  return resultData;
}

// --- Проверка готовности всех игроков (для будущего) ---
export function areAllPlayersReady(roomId) {
  const outfits = getAllOutfitsInRoom(roomId);
  const players = Object.keys(outfits);

  if (players.length < 2) return false;

  return players.every((player) => outfits[player].isReady === true);
}

// --- Получение результатов для страницы ---
export function getResultsForRoom(roomId) {
  try {
    const raw = localStorage.getItem(RESULTS_KEY_PREFIX + roomId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
