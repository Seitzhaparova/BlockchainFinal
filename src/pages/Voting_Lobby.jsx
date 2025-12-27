// src/pages/Voting_Lobby.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";
import {
  getAllOutfitsInRoom,
  calculateAndSaveResults,
} from "../utils/outfitStorage";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// ======================
// TUNING CONSTANTS (скопировано из Game_Active)
// ======================
const STAGE_W = 180;
const STAGE_H = 300;

const Z_BODY = 1;
const Z_STOCKINGS = 10;
const Z_SOCKS = 11;
const Z_SHOES_UNDER_PANTS = 12;
const Z_DOWN = 20;
const Z_UP = 30;
const Z_DRESS = 30;
const Z_NECKLACE = 33;
const Z_HAIR = 40;
const Z_HEAD_ACCESSORY = 45;
const Z_SHOES_OVER_ALL = 50;

const HAIR_X_NUDGE = 60;
const HAIR_Y_NUDGE = 10;

const UP_SHORT_X_NUDGE = 50;
const UP_SHORT_Y_NUDGE = 0;
const UP_SHORT_WIDTH_FACTOR = 1.35;

const UP_LONG_X_NUDGE = 30;
const UP_LONG_Y_NUDGE = 0;
const UP_LONG_WIDTH_FACTOR = 2.15;

const JEANS_X_NUDGE = 180;
const JEANS_Y_NUDGE = 320;
const JEANS_WIDTH_FACTOR = 1.75;

const SKIRT_X_NUDGE = -35;
const SKIRT_Y_NUDGE = 320;
const SKIRT_WIDTH_FACTOR = 1.4;

const DRESS_SLEEVES_X_NUDGE = 200;
const DRESS_SLEEVES_Y_NUDGE = 100;
const DRESS_SLEEVES_WIDTH_FACTOR = 2.4;

const DRESS_NO_SLEEVES_X_NUDGE = 0;
const DRESS_NO_SLEEVES_Y_NUDGE = 130;
const DRESS_NO_SLEEVES_WIDTH_FACTOR = 1.6;

const SHOES_SHORT_X_NUDGE = 260;
const SHOES_SHORT_Y_NUDGE = 1465;
const SHOES_SHORT_WIDTH_FACTOR = 1.35;

const SHOES_LONG_X_NUDGE = 260;
const SHOES_LONG_Y_NUDGE = 1060;
const SHOES_LONG_WIDTH_FACTOR = 1.45;

const HAIRCLIPS_X_NUDGE = 70;
const HAIRCLIPS_Y_NUDGE = 130;
const HAIRCLIPS_WIDTH_FACTOR = 0.9;

const HEADPHONES_X_NUDGE = -65;
const HEADPHONES_Y_NUDGE = 500;
const HEADPHONES_WIDTH_FACTOR = 1.15;

const NECKLACE_X_NUDGE = 90;
const NECKLACE_Y_NUDGE = -250;
const NECKLACE_WIDTH_FACTOR = 0.5;

const STOCKINGS_X_NUDGE = 195;
const STOCKINGS_Y_NUDGE = 285;
const STOCKINGS_WIDTH_FACTOR = 1.45;

const SOCKS_X_NUDGE = 260;
const SOCKS_Y_NUDGE = 1365;
const SOCKS_WIDTH_FACTOR = 1.35;
// Добавьте в начало Voting_Lobby.jsx (перед всеми функциями)
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
// Функция для сканирования тела и получения метаданных
async function scanBodyMeta(bodyUrl) {
  const img = await loadImage(bodyUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  function scanRegionBBox(x0, y0, x1, y1) {
    const sw = x1 - x0;
    const sh = y1 - y0;
    const { data } = ctx.getImageData(x0, y0, sw, sh);

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const a = data[i + 3];
        if (a > 10) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!Number.isFinite(minX)) return null;

    return {
      left: x0 + minX,
      right: x0 + maxX,
      top: y0 + minY,
      bottom: y0 + maxY,
    };
  }

  const head = scanRegionBBox(
    Math.floor(w * 0.35),
    0,
    Math.floor(w * 0.68),
    Math.floor(h * 0.18)
  ) ?? {
    left: w * 0.45,
    right: w * 0.65,
    top: 0,
    bottom: h * 0.12,
  };

  const torso = scanRegionBBox(
    Math.floor(w * 0.3),
    Math.floor(h * 0.16),
    Math.floor(w * 0.7),
    Math.floor(h * 0.55)
  ) ?? {
    left: w * 0.38,
    right: w * 0.62,
    top: h * 0.2,
    bottom: h * 0.55,
  };

  const hips = scanRegionBBox(
    Math.floor(w * 0.3),
    Math.floor(h * 0.3),
    Math.floor(w * 0.7),
    Math.floor(h * 0.66)
  ) ?? {
    left: w * 0.38,
    right: w * 0.62,
    top: h * 0.33,
    bottom: h * 0.62,
  };

  const lower = scanRegionBBox(
    Math.floor(w * 0.25),
    Math.floor(h * 0.42),
    Math.floor(w * 0.75),
    Math.floor(h * 0.98)
  ) ?? {
    left: w * 0.35,
    right: w * 0.65,
    top: h * 0.45,
    bottom: h * 0.98,
  };

  return { bodyW: w, bodyH: h, head, torso, hips, lower };
}

// Вспомогательные функции для позиционирования
function ScaledLayer({ src, x, y, w, h, scale, z }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        zIndex: z,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function AnchorToBBox({
  src,
  size,
  bbox,
  widthFactor,
  xNudge,
  yNudge,
  yBase,
  z,
}) {
  if (!src || !size || !bbox) return null;
  const bw = Math.max(1, bbox.right - bbox.left);
  const cx = (bbox.left + bbox.right) / 2;

  const targetW = bw * widthFactor;
  const scale = targetW / size.w;

  const x0 = cx - (size.w * scale) / 2 + xNudge;
  const y0 = yBase + yNudge;

  return (
    <ScaledLayer
      src={src}
      x={x0}
      y={y0}
      w={size.w}
      h={size.h}
      scale={scale}
      z={z}
    />
  );
}

// Компонент для отображения полного аутфита с системой NUDGE
function OutfitDisplay({ outfit }) {
  const [bodyMeta, setBodyMeta] = useState(null);
  const [sizes, setSizes] = useState({
    hair: null,
    shoes: null,
    up: null,
    down: null,
    dress: null,
    hairclips: null,
    headphones: null,
    necklace: null,
    stockings: null,
    socks: null,
  });
  const sizeCacheRef = useRef(new Map());

  // Получаем размер изображения
  async function getSizeCached(url) {
    if (!url) return null;
    if (sizeCacheRef.current.has(url)) return sizeCacheRef.current.get(url);
    const img = await loadImage(url);
    const size = { w: img.naturalWidth, h: img.naturalHeight };
    sizeCacheRef.current.set(url, size);
    return size;
  }

  // Загружаем метаданные тела
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!outfit?.body) return;
      try {
        const meta = await scanBodyMeta(outfit.body);
        if (!cancelled) setBodyMeta(meta);
      } catch (e) {
        console.error("scanBodyMeta error:", e);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [outfit?.body]);

  // Загружаем размеры всех частей одежды
  useEffect(() => {
    let cancelled = false;
    async function loadAllSizes() {
      const newSizes = {
        hair: await getSizeCached(outfit?.hair),
        shoes: await getSizeCached(outfit?.shoes),
        up: await getSizeCached(outfit?.up),
        down: await getSizeCached(outfit?.down),
        dress: await getSizeCached(outfit?.dress),
        hairclips: await getSizeCached(outfit?.hairclips),
        headphones: await getSizeCached(outfit?.headphones),
        necklace: await getSizeCached(outfit?.necklace),
        stockings: await getSizeCached(outfit?.stockings),
        socks: await getSizeCached(outfit?.socks),
      };
      if (!cancelled) setSizes(newSizes);
    }
    loadAllSizes();
    return () => (cancelled = true);
  }, [outfit]);

  if (!outfit || !outfit.body) {
    return (
      <div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          background: "linear-gradient(135deg, #f5f5f5, #e0e0e0)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          border: "1px solid #ddd",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px" }}>👗</div>
          <div style={{ fontSize: "12px", marginTop: "8px" }}>NO OUTFIT</div>
        </div>
      </div>
    );
  }

  // Определяем типы одежды
  const downKind = outfit?.down
    ? outfit.down.toLowerCase().includes("jeans")
      ? "jeans"
      : "skirt"
    : null;
  const upKind = outfit?.up
    ? outfit.up.toLowerCase().includes("shirt 2") ||
      outfit.up.toLowerCase().includes("shirt_2")
      ? "long"
      : "short"
    : null;
  const dressKind = outfit?.dress
    ? outfit.dress.toLowerCase().includes("sleeve") ||
      outfit.dress.toLowerCase().includes("long") ||
      outfit.dress.toLowerCase().includes("dress 2") ||
      outfit.dress.toLowerCase().includes("dress_2")
      ? "sleeves"
      : "no_sleeves"
    : null;
  const shoesKind = outfit?.shoes
    ? outfit.shoes.toLowerCase().includes("boot") ||
      outfit.shoes.toLowerCase().includes("boots") ||
      outfit.shoes.toLowerCase().includes("long") ||
      outfit.shoes.toLowerCase().includes("shoes 3") ||
      outfit.shoes.toLowerCase().includes("shoes_3")
      ? "long"
      : "short"
    : null;

  const shoesZ = outfit?.dress
    ? Z_SHOES_OVER_ALL
    : !outfit?.down
    ? Z_SHOES_OVER_ALL
    : downKind !== "jeans"
    ? Z_SHOES_OVER_ALL
    : Z_SHOES_UNDER_PANTS;

  // Вычисляем layout
  const stageLayout = useMemo(() => {
    if (!bodyMeta) return null;
    const { bodyW, bodyH, head } = bodyMeta;

    const scale = Math.min(STAGE_W / bodyW, STAGE_H / bodyH);
    const scaledW = bodyW * scale;
    const scaledH = bodyH * scale;
    const artLeft = (STAGE_W - scaledW) / 2;
    const artTop = (STAGE_H - scaledH) / 2;

    let hairPos = null;
    if (sizes.hair && head) {
      const headCx = (head.left + head.right) / 2;
      const headTop = head.top;

      const hx = Math.round(headCx - sizes.hair.w / 2 + HAIR_X_NUDGE);
      const hy = Math.round(headTop - sizes.hair.h * 0.08 + HAIR_Y_NUDGE);
      hairPos = { x: hx, y: hy, s: 1 };
    }

    return { scale, artLeft, artTop, bodyW, bodyH, hairPos };
  }, [bodyMeta, sizes.hair]);

  // Функции для рендеринга слоев
  function FullLayer({ src, z }) {
    if (!src || !stageLayout) return null;
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: stageLayout.bodyW,
          height: stageLayout.bodyH,
          zIndex: z,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    );
  }

  function HairLayer({ src, z }) {
    if (!src || !stageLayout?.hairPos || !sizes.hair) return null;
    const { x, y, s } = stageLayout.hairPos;
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: sizes.hair.w * s,
          height: sizes.hair.h * s,
          zIndex: z,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    );
  }

  function UpLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.torso || !sizes.up || !kind) return null;
    const torso = bodyMeta.torso;
    const isLong = kind === "long";

    const widthFactor = isLong ? UP_LONG_WIDTH_FACTOR : UP_SHORT_WIDTH_FACTOR;
    const xNudge = isLong ? UP_LONG_X_NUDGE : UP_SHORT_X_NUDGE;
    const yNudge = isLong ? UP_LONG_Y_NUDGE : UP_SHORT_Y_NUDGE;

    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top - torsoH * 0.1;

    return (
      <AnchorToBBox
        src={src}
        size={sizes.up}
        bbox={torso}
        widthFactor={widthFactor}
        xNudge={xNudge}
        yNudge={yNudge}
        yBase={yBase}
        z={z}
      />
    );
  }

  function DownLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.hips || !sizes.down || !kind) return null;
    const hips = bodyMeta.hips;
    const isJeans = kind === "jeans";

    const widthFactor = isJeans ? JEANS_WIDTH_FACTOR : SKIRT_WIDTH_FACTOR;
    const xNudge = isJeans ? JEANS_X_NUDGE : SKIRT_X_NUDGE;
    const yNudge = isJeans ? JEANS_Y_NUDGE : SKIRT_Y_NUDGE;

    const yBase = hips.top;

    return (
      <AnchorToBBox
        src={src}
        size={sizes.down}
        bbox={hips}
        widthFactor={widthFactor}
        xNudge={xNudge}
        yNudge={yNudge}
        yBase={yBase}
        z={z}
      />
    );
  }

  function DressLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.torso || !sizes.dress || !kind) return null;
    const torso = bodyMeta.torso;
    const isSleeves = kind === "sleeves";

    const widthFactor = isSleeves
      ? DRESS_SLEEVES_WIDTH_FACTOR
      : DRESS_NO_SLEEVES_WIDTH_FACTOR;
    const xNudge = isSleeves ? DRESS_SLEEVES_X_NUDGE : DRESS_NO_SLEEVES_X_NUDGE;
    const yNudge = isSleeves ? DRESS_SLEEVES_Y_NUDGE : DRESS_NO_SLEEVES_Y_NUDGE;

    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top - torsoH * 0.12;

    return (
      <AnchorToBBox
        src={src}
        size={sizes.dress}
        bbox={torso}
        widthFactor={widthFactor}
        xNudge={xNudge}
        yNudge={yNudge}
        yBase={yBase}
        z={z}
      />
    );
  }

  function ShoesLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.lower || !sizes.shoes || !kind) return null;
    const lower = bodyMeta.lower;
    const isLong = kind === "long";

    const widthFactor = isLong
      ? SHOES_LONG_WIDTH_FACTOR
      : SHOES_SHORT_WIDTH_FACTOR;
    const xNudge = isLong ? SHOES_LONG_X_NUDGE : SHOES_SHORT_X_NUDGE;
    const yNudge = isLong ? SHOES_LONG_Y_NUDGE : SHOES_SHORT_Y_NUDGE;

    const yBase = lower.top;

    return (
      <AnchorToBBox
        src={src}
        size={sizes.shoes}
        bbox={lower}
        widthFactor={widthFactor}
        xNudge={xNudge}
        yNudge={yNudge}
        yBase={yBase}
        z={z}
      />
    );
  }

  function HairclipsLayer() {
    if (!outfit?.hairclips || !bodyMeta?.head || !sizes.hairclips) return null;
    const head = bodyMeta.head;
    const headH = Math.max(1, head.bottom - head.top);
    const yBase = head.top - headH * 0.1;

    return (
      <AnchorToBBox
        src={outfit.hairclips}
        size={sizes.hairclips}
        bbox={head}
        widthFactor={HAIRCLIPS_WIDTH_FACTOR}
        xNudge={HAIRCLIPS_X_NUDGE}
        yNudge={HAIRCLIPS_Y_NUDGE}
        yBase={yBase}
        z={Z_HEAD_ACCESSORY}
      />
    );
  }

  function HeadphonesLayer() {
    if (!outfit?.headphones || !bodyMeta?.head || !sizes.headphones)
      return null;
    const head = bodyMeta.head;
    const headH = Math.max(1, head.bottom - head.top);
    const yBase = head.top - headH * 0.08;

    return (
      <AnchorToBBox
        src={outfit.headphones}
        size={sizes.headphones}
        bbox={head}
        widthFactor={HEADPHONES_WIDTH_FACTOR}
        xNudge={HEADPHONES_X_NUDGE}
        yNudge={HEADPHONES_Y_NUDGE}
        yBase={yBase}
        z={Z_HEAD_ACCESSORY}
      />
    );
  }

  function NecklaceLayer() {
    if (!outfit?.necklace || !bodyMeta?.torso || !sizes.necklace) return null;
    const torso = bodyMeta.torso;
    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top + torsoH * 0.08;

    return (
      <AnchorToBBox
        src={outfit.necklace}
        size={sizes.necklace}
        bbox={torso}
        widthFactor={NECKLACE_WIDTH_FACTOR}
        xNudge={NECKLACE_X_NUDGE}
        yNudge={NECKLACE_Y_NUDGE}
        yBase={yBase}
        z={Z_NECKLACE}
      />
    );
  }

  function StockingsLayer() {
    if (!outfit?.stockings || !bodyMeta?.lower || !sizes.stockings) return null;
    const lower = bodyMeta.lower;
    const yBase = lower.top;

    return (
      <AnchorToBBox
        src={outfit.stockings}
        size={sizes.stockings}
        bbox={lower}
        widthFactor={STOCKINGS_WIDTH_FACTOR}
        xNudge={STOCKINGS_X_NUDGE}
        yNudge={STOCKINGS_Y_NUDGE}
        yBase={yBase}
        z={Z_STOCKINGS}
      />
    );
  }

  function SocksLayer() {
    if (!outfit?.socks || !bodyMeta?.lower || !sizes.socks) return null;
    const lower = bodyMeta.lower;
    const yBase = lower.top;

    return (
      <AnchorToBBox
        src={outfit.socks}
        size={sizes.socks}
        bbox={lower}
        widthFactor={SOCKS_WIDTH_FACTOR}
        xNudge={SOCKS_X_NUDGE}
        yNudge={SOCKS_Y_NUDGE}
        yBase={yBase}
        z={Z_SOCKS}
      />
    );
  }

  return (
    <div
      style={{
        width: STAGE_W,
        height: STAGE_H,
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.35)",
        border: "1px solid rgba(36, 12, 58, 0.25)",
      }}
    >
      {stageLayout ? (
        <div
          style={{
            position: "absolute",
            left: stageLayout.artLeft,
            top: stageLayout.artTop,
            width: stageLayout.bodyW,
            height: stageLayout.bodyH,
            transform: `scale(${stageLayout.scale})`,
            transformOrigin: "top left",
          }}
        >
          <FullLayer src={outfit.body} z={Z_BODY} />

          {outfit.dress ? (
            <>
              <StockingsLayer />
              <SocksLayer />
              <DressLayer src={outfit.dress} kind={dressKind} z={Z_DRESS} />
            </>
          ) : (
            <>
              <DownLayer src={outfit.down} kind={downKind} z={Z_DOWN} />
              <StockingsLayer />
              <SocksLayer />
              <UpLayer src={outfit.up} kind={upKind} z={Z_UP} />
            </>
          )}

          <NecklaceLayer />
          <HairLayer src={outfit.hair} z={Z_HAIR} />
          <HairclipsLayer />
          <HeadphonesLayer />
          <ShoesLayer src={outfit.shoes} kind={shoesKind} z={shoesZ} />
        </div>
      ) : (
        // Заглушка пока загружаются метаданные
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.8)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px" }}>👗</div>
            <div style={{ fontSize: "10px", marginTop: "4px" }}>Loading...</div>
          </div>
        </div>
      )}

      {/* Индикатор бота */}
      {outfit.isBot && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "rgba(36, 12, 58, 0.8)",
            color: "white",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: "bold",
            zIndex: 100,
          }}
        >
          BOT
        </div>
      )}
    </div>
  );
}

// Компонент звезд для голосования
function StarRating({ rating, onRate, disabled }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        marginTop: "8px",
        justifyContent: "center",
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          disabled={disabled}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            fontSize: "24px",
            color: star <= rating ? "#FFD86B" : "#ccc",
            padding: "0 2px",
            transition: "transform 0.1s",
          }}
          onMouseEnter={(e) =>
            !disabled && (e.currentTarget.style.transform = "scale(1.2)")
          }
          onMouseLeave={(e) =>
            !disabled && (e.currentTarget.style.transform = "scale(1)")
          }
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function VotingLobby() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [account, setAccount] = useState(null);
  const [outfits, setOutfits] = useState({});
  const [ratings, setRatings] = useState({});
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Проверяем подключенный кошелек
  useEffect(() => {
    const checkWallet = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts[0]) {
            setAccount(accounts[0]);
          } else {
            const newAccounts = await window.ethereum.request({
              method: "eth_requestAccounts",
            });
            if (newAccounts[0]) {
              setAccount(newAccounts[0]);
            }
          }
        } catch (error) {
          console.error("Wallet connection error:", error);
          setStatus("Ошибка подключения кошелька");
        }
      }
    };

    checkWallet();
  }, []);

  // 2. Загружаем все аутфиты в комнате
  useEffect(() => {
    const outfitsData = getAllOutfitsInRoom(roomId);
    setOutfits(outfitsData);

    // Инициализируем рейтинги нулями для всех игроков кроме себя
    const initialRatings = {};
    Object.keys(outfitsData).forEach((addr) => {
      if (!account || addr.toLowerCase() !== account.toLowerCase()) {
        initialRatings[addr] = 0;
      }
    });
    setRatings(initialRatings);
  }, [roomId, account]);

  // 3. Игроки для голосования (все кроме себя)
  const playersToVote = useMemo(() => {
    if (!account) return [];
    return Object.entries(outfits)
      .filter(([addr]) => addr.toLowerCase() !== account.toLowerCase())
      .map(([addr, data]) => ({ address: addr, ...data }));
  }, [outfits, account]);

  // 4. Текущий игрок (мой аутфит)
  const myOutfit = useMemo(() => {
    if (!account) return null;
    return outfits[account] || null;
  }, [outfits, account]);

  // 5. Обработка голосования
  const handleRate = (playerAddress, score) => {
    setRatings((prev) => ({
      ...prev,
      [playerAddress]: score,
    }));
  };

  // 6. Отправка голосов и подсчет результатов
  const submitVotes = () => {
    // Проверяем, что все игроки оценены
    const unratedPlayers = playersToVote.filter(
      (player) => !ratings[player.address] || ratings[player.address] === 0
    );

    if (unratedPlayers.length > 0) {
      setStatus(
        `Пожалуйста, оцените всех игроков! Осталось: ${unratedPlayers.length}`
      );
      return;
    }

    setIsSubmitting(true);
    setStatus("Подсчитываем результаты...");

    // Сохраняем результаты
    const results = calculateAndSaveResults(roomId, account, ratings);
    console.log("Results calculated:", results);

    setTimeout(() => {
      navigate(`/result/${roomId}`);
    }, 1500);
  };

  // 7. Если нет игроков для голосования
  if (playersToVote.length === 0) {
    return (
      <div className="start-root">
        <div className="glow-circle glow-1" />
        <div className="glow-circle glow-2" />

        <header className="start-header">
          <div className="brand">
            <span className="brand-mark">★</span>
            <span className="brand-name">DressChain</span>
          </div>

          <div className="wallet-pill">
            {account ? (
              <>
                <span className="wallet-label">Кошелек</span>
                <span className="wallet-address">
                  {shortenAddress(account)}
                </span>
              </>
            ) : (
              <span className="wallet-disconnected">Не подключен</span>
            )}
          </div>
        </header>

        <main className="active-main">
          <section className="active-card">
            <div style={{ textAlign: "center", padding: "40px" }}>
              <h2 style={{ color: "rgba(36, 12, 58, 0.92)" }}>
                Ожидаем других игроков...
              </h2>
              <p style={{ color: "rgba(36, 12, 58, 0.7)", margin: "20px 0" }}>
                В комнате пока нет других игроков для голосования.
                <br />
                Вернитесь, когда другие игроки сохранят свои образы.
              </p>
              <button
                className="btn primary"
                onClick={() => navigate(`/active/${roomId}`)}
                style={{ marginTop: "20px" }}
              >
                Вернуться к созданию образа
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="start-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      <header className="start-header">
        <div className="brand">
          <span className="brand-mark">★</span>
          <span className="brand-name">DRESSCHAIN</span>
        </div>

        <div className="wallet-pill">
          {account ? (
            <>
              <span className="wallet-label">Кошелек</span>
              <span className="wallet-address">{shortenAddress(account)}</span>
              <span className="lobby-dot ok" />
            </>
          ) : (
            <>
              <span className="wallet-disconnected">Не подключен</span>
              <span className="lobby-dot" />
            </>
          )}
        </div>
      </header>

      <main className="active-main">
        <section className="active-card">
          <h2
            className="start-title"
            style={{ textAlign: "center", color: "rgba(36, 12, 58, 0.92)" }}
          >
            Оцените образы других игроков
          </h2>
          <p
            className="start-subtitle"
            style={{ textAlign: "center", color: "rgba(36, 12, 58, 0.7)" }}
          >
            Поставьте от 1 до 5 звезд каждому игроку (кроме себя)
          </p>

          {/* Все игроки в одном ряду */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "24px",
              marginTop: "30px",
            }}
          >
            {/* Мой аутфит (первый, без возможности оценки) */}
            {myOutfit && (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "16px",
                  padding: "20px",
                  border: "2px solid rgba(255, 77, 166, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  boxShadow: "0 8px 25px rgba(33, 7, 58, 0.08)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    left: "12px",
                    background: "rgba(255, 77, 166, 0.9)",
                    color: "white",
                    fontSize: "12px",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontWeight: "bold",
                  }}
                >
                  ВЫ
                </div>

                {/* Превью моего аутфита с системой NUDGE */}
                <div
                  style={{
                    width: STAGE_W,
                    height: STAGE_H,
                    marginBottom: "16px",
                    marginTop: "10px",
                  }}
                >
                  <OutfitDisplay outfit={myOutfit} />
                </div>

                {/* Адрес */}
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                    color: "rgba(36, 12, 58, 0.92)",
                    textAlign: "center",
                  }}
                >
                  {shortenAddress(account)}
                </div>

                {/* Сообщение о невозможности голосования */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "rgba(36, 12, 58, 0.6)",
                    marginTop: "8px",
                    textAlign: "center",
                    fontStyle: "italic",
                    background: "rgba(255, 216, 107, 0.1)",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    width: "100%",
                  }}
                >
                  Вы не можете голосовать за себя
                </div>
              </div>
            )}

            {/* Игроки для голосования */}
            {playersToVote.map((player) => (
              <div
                key={player.address}
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "16px",
                  padding: "20px",
                  border: "1px solid rgba(0,0,0,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  boxShadow: "0 8px 25px rgba(33, 7, 58, 0.08)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-5px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                {/* Превью аутфита с системой NUDGE */}
                <div
                  style={{
                    width: STAGE_W,
                    height: STAGE_H,
                    marginBottom: "16px",
                  }}
                >
                  <OutfitDisplay outfit={player} />
                </div>

                {/* Имя и адрес игрока */}
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                    color: "rgba(36, 12, 58, 0.92)",
                    textAlign: "center",
                  }}
                >
                  {player.address.startsWith("0xBot") ? (
                    <>
                      <div>{player.name || "Fashion Bot"}</div>
                      <div
                        style={{
                          fontSize: "10px",
                          opacity: 0.7,
                          fontWeight: "normal",
                        }}
                      >
                        {player.address.slice(0, 8)}...
                      </div>
                    </>
                  ) : (
                    <div>{shortenAddress(player.address)}</div>
                  )}
                </div>

                {/* Рейтинг */}
                <StarRating
                  rating={ratings[player.address] || 0}
                  onRate={(score) => handleRate(player.address, score)}
                  disabled={isSubmitting}
                />

                {/* Текущий рейтинг */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "#FFD86B",
                    marginTop: "8px",
                    fontWeight: "bold",
                    background: "rgba(255, 216, 107, 0.1)",
                    padding: "4px 12px",
                    borderRadius: "20px",
                  }}
                >
                  {ratings[player.address] || 0} / 5 звезд
                </div>
              </div>
            ))}
          </div>

          {/* Кнопка отправки */}
          <div
            style={{
              marginTop: "40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <button
              className="btn primary"
              style={{
                padding: "12px 32px",
                fontSize: "16px",
                minWidth: "200px",
              }}
              onClick={submitVotes}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Подсчет..." : "ОТПРАВИТЬ ГОЛОСА"}
            </button>

            {status && (
              <div
                style={{
                  padding: "10px 20px",
                  background: status.includes("ошибка")
                    ? "rgba(255, 107, 107, 0.1)"
                    : "rgba(255, 216, 107, 0.1)",
                  borderRadius: "8px",
                  color: status.includes("ошибка")
                    ? "#ff6b6b"
                    : "rgba(36, 12, 58, 0.8)",
                  border: `1px solid ${
                    status.includes("ошибка") ? "#ff6b6b" : "#FFD86B"
                  }`,
                  maxWidth: "400px",
                  textAlign: "center",
                }}
              >
                {status}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
