// src/pages/Result_Page.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

// ✅ Fashion show background (full scene, replaces confetti)
import bgImg from "../assets/results/background.png";
import { getResultsForRoom } from "../utils/outfitStorage";

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// ======================
// TUNING CONSTANTS (скопировано из Game_Active)
// ======================
const STAGE_W = 90; // Увеличим размер для результатов
const STAGE_H = 190;

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

// Функция для загрузки изображения
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

// Компонент для отображения полного аутфита с системой NUDGE
function WinnerOutfitDisplay({ outfit }) {
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
      <div style={{
        width: STAGE_W,
        height: STAGE_H,
        background: "linear-gradient(135deg, #f5f5f5, #e0e0e0)",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
        border: "1px solid #ddd"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px" }}>👗</div>
          <div style={{ fontSize: "10px", marginTop: "4px" }}>NO OUTFIT</div>
        </div>
      </div>
    );
  }

  // Определяем типы одежды
  const downKind = outfit?.down ? 
    (outfit.down.toLowerCase().includes("jeans") ? "jeans" : "skirt") : null;
  const upKind = outfit?.up ?
    (outfit.up.toLowerCase().includes("shirt 2") || outfit.up.toLowerCase().includes("shirt_2") ? "long" : "short") : null;
  const dressKind = outfit?.dress ?
    (outfit.dress.toLowerCase().includes("sleeve") || outfit.dress.toLowerCase().includes("long") || 
     outfit.dress.toLowerCase().includes("dress 2") || outfit.dress.toLowerCase().includes("dress_2") ? "sleeves" : "no_sleeves") : null;
  const shoesKind = outfit?.shoes ?
    (outfit.shoes.toLowerCase().includes("boot") || outfit.shoes.toLowerCase().includes("boots") || 
     outfit.shoes.toLowerCase().includes("long") || outfit.shoes.toLowerCase().includes("shoes 3") || 
     outfit.shoes.toLowerCase().includes("shoes_3") ? "long" : "short") : null;
  
  const shoesZ = outfit?.dress ? Z_SHOES_OVER_ALL : 
                (!outfit?.down ? Z_SHOES_OVER_ALL : 
                (downKind !== "jeans" ? Z_SHOES_OVER_ALL : Z_SHOES_UNDER_PANTS));

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

    const widthFactor = isSleeves ? DRESS_SLEEVES_WIDTH_FACTOR : DRESS_NO_SLEEVES_WIDTH_FACTOR;
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

    const widthFactor = isLong ? SHOES_LONG_WIDTH_FACTOR : SHOES_SHORT_WIDTH_FACTOR;
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
    if (!outfit?.headphones || !bodyMeta?.head || !sizes.headphones) return null;
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
    <div style={{
      width: STAGE_W,
      height: STAGE_H,
      position: "relative",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {stageLayout ? (
        <div style={{
          position: "absolute",
          left: stageLayout.artLeft,
          top: stageLayout.artTop,
          width: stageLayout.bodyW,
          height: stageLayout.bodyH,
          transform: `scale(${stageLayout.scale})`,
          transformOrigin: "top left",
        }}>
          <FullLayer src={outfit.body} z={Z_BODY} />

          {outfit.dress ? (
            <>
              <StockingsLayer />
              <SocksLayer />
              <DressLayer
                src={outfit.dress}
                kind={dressKind}
                z={Z_DRESS}
              />
            </>
          ) : (
            <>
              <DownLayer
                src={outfit.down}
                kind={downKind}
                z={Z_DOWN}
              />
              <StockingsLayer />
              <SocksLayer />
              <UpLayer src={outfit.up} kind={upKind} z={Z_UP} />
            </>
          )}

          <NecklaceLayer />
          <HairLayer src={outfit.hair} z={Z_HAIR} />
          <HairclipsLayer />
          <HeadphonesLayer />
          <ShoesLayer
            src={outfit.shoes}
            kind={shoesKind}
            z={shoesZ}
          />
        </div>
      ) : (
        // Заглушка пока загружаются метаданные
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.8)"
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px" }}>👗</div>
            <div style={{ fontSize: "10px", marginTop: "4px" }}>Loading...</div>
          </div>
        </div>
      )}
            
    </div>
  );
}

// mock balance
async function fetchTokenBalance(_address) {
  return Math.floor(Math.random() * 1000);
}

function getEthereum() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

const CHAT_TTL_MS = 5 * 1000; 

// Skeleton JSON loader
function loadResultsSkeleton(roomId) {
  return getResultsForRoom(roomId);
}

function buildWinnersFromJson(resultsJson) {
  const fallback = [
    { rank: 1, address: "", score: "", outfit: {}, chatText: "", chatUntil: 0 },
    { rank: 2, address: "", score: "", outfit: {}, chatText: "", chatUntil: 0 },
    { rank: 3, address: "", score: "", outfit: {}, chatText: "", chatUntil: 0 },
  ];

  if (!resultsJson?.winners || !Array.isArray(resultsJson.winners)) return fallback;

  const map = new Map();
  for (const w of resultsJson.winners) {
    const r = Number(w?.rank);
    if (r === 1 || r === 2 || r === 3) map.set(r, w);
  }

  return [1, 2, 3].map((r, i) => {
    const w = map.get(r) || {};
    return {
      rank: r,
      address: w.address || "",
      score: typeof w.score === "number" ? w.score : w.score || "",
      outfit: w.outfit || {},
      chatText: "",
      chatUntil: 0,
      name: w.name || (w.address?.startsWith("0xBot") ? "Fashion Bot" : "Player"),
      isBot: w.isBot || false
    };
  });
}

export default function ResultPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [account, setAccount] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);

  const [status, setStatus] = useState("");
  const [chatInput, setChatInput] = useState("");

  const [winners, setWinners] = useState(() => {
    const json = loadResultsSkeleton(roomId);
    return buildWinnersFromJson(json);
  });

  // Wallet auto-detect (no popup). If not connected -> go start
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) {
      setStatus("MetaMask не найден. Установи MetaMask.");
      navigate("/", { replace: true });
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        const acc = accounts?.[0] ?? null;

        if (!mounted) return;

        if (!acc) {
          setStatus("Кошелёк не подключён. Подключи на стартовой странице.");
          navigate("/", { replace: true });
          return;
        }

        setAccount(acc);
      } catch (e) {
        console.error("wallet init error:", e);
        setStatus("Ошибка MetaMask. Вернись на стартовой странице.");
        navigate("/", { replace: true });
      }
    }

    init();

    const onAccountsChanged = (accs) => {
      const acc = accs?.[0] ?? null;
      setAccount(acc);
      if (!acc) navigate("/", { replace: true });
    };

    const onChainChanged = () => window.location.reload();

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);

    return () => {
      mounted = false;
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [navigate]);

  // Load balance
  useEffect(() => {
    if (!account) return;
    (async () => {
      try {
        const b = await fetchTokenBalance(account);
        setTokenBalance(b);
      } catch {
        setTokenBalance(0);
      }
    })();
  }, [account]);

  // Load winners JSON by roomId (skeleton)
  useEffect(() => {
    const json = loadResultsSkeleton(roomId);
    setWinners(buildWinnersFromJson(json));
  }, [roomId]);

  // chat TTL cleanup
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setWinners((prev) => {
        let changed = false;
        const next = prev.map((w) => {
          if (w.chatUntil && w.chatUntil <= now && w.chatText) {
            changed = true;
            return { ...w, chatText: "", chatUntil: 0 };
          }
          return w;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const myWinnerIndex = useMemo(() => {
    if (!account) return -1;
    return winners.findIndex(
      (w) => w.address && w.address.toLowerCase?.() === account.toLowerCase()
    );
  }, [account, winners]);

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;

    if (myWinnerIndex === -1) {
      setStatus("Твой кошелёк не в топ-3 (пока чат показывается только над победителями).");
      setChatInput("");
      return;
    }

    const until = Date.now() + CHAT_TTL_MS;

    setWinners((prev) => {
      const next = [...prev];
      next[myWinnerIndex] = { ...next[myWinnerIndex], chatText: text, chatUntil: until };
      return next;
    });

    setChatInput("");
    setStatus("");
  }

  function onChatKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  }

  function handleLeaveRoom() {
    navigate("/lobby/" + roomId);
  }

  function handleBackToStart() {
    navigate("/");
  }

  // ✅ Ваши настроенные позиции (девушки + информационные баблы)
  const slotPos = {
    1: { left: "50%", bottom: "50%", size: 190 },
    2: { left: "30%", bottom: "40%", size: 165 },
    3: { left: "70%", bottom: "35%", size: 165 },
  };

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
          <div className="wallet-balance">
            <span className="wallet-label">Balance</span>
            <span className="wallet-balance-value">{tokenBalance} tokens</span>
          </div>

          <span className="wallet-sep" />

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
        <section className="active-card" style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr minmax(240px, 320px)",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            {/* CENTER STAGE */}
            <div
              style={{
                position: "relative",
                borderRadius: 18,
                background: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(0,0,0,0.06)",
                minHeight: 520,
                padding: 18,
                display: "grid",
                placeItems: "end center",
                paddingBottom: 0,
                overflow: "hidden",
              }}
            >
              {/* ✅ Fashion show background behind everything */}
              <img
                src={bgImg}
                alt="fashion-show background"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />

              {/* Podium + winners */}
              <div
                style={{
                  position: "relative",
                  width: "min(980px, 100%)",
                  height: 470,
                  zIndex: 1, // above bg
                }}
              >

                {/* Winners on top of podium */}
                {winners.map((w) => {
                  const pos = slotPos[w.rank] || slotPos[3];
                  
                  const showChat = w.chatText && w.chatUntil > Date.now();
                  const walletText = w.address ? shortenAddress(w.address) : "—";
                  const scoreText = w.score !== "" ? w.score : "—";

                  return (
                    <div
                      key={w.rank}
                      style={{
                        position: "absolute",
                        left: pos.left,
                        bottom: pos.bottom,
                        transform: "translateX(-50%)",
                        display: "grid",
                        justifyItems: "center",
                        gap: 10,
                        zIndex: 2, // ✅ ensure above podium
                      }}
                    >
                      {/* Player info bubble */}
                      <div
                        style={{
                          padding: "5px 5px",
                          borderRadius: 999,
                          background: w.rank === 1 
                            ? "rgba(255, 215, 0, 0.3)" 
                            : w.rank === 2
                            ? "rgba(192, 192, 192, 0.3)"
                            : "rgba(205, 127, 50, 0.3)",
                          border: w.rank === 1 
                            ? "2px solid #FFD700" 
                            : w.rank === 2
                            ? "2px solid #C0C0C0"
                            : "2px solid #CD7F32",
                          color: "rgba(36,12,58,0.92)",
                          fontSize: 10,
                          fontWeight: 700,
                          textAlign: "center",
                          boxShadow: "0 10px 22px rgba(33,7,58,0.12)",
                          textShadow: '0 0 2px pink, 0 0 2px black, 0 0 2px black, 0 0 2px pink',
                          maxWidth: 220,
                          minWidth: 180,
                        }}
                      >
                        <div style={{ 
                          fontSize: "12px", 
                          fontWeight: "800",
                          color: w.rank === 1 ? "#FFD700" : w.rank === 2 ? "#C0C0C0" : "#5c2f02ff"
                        }}>
                          {w.rank === 1 ? "🥇 WINNER" : w.rank === 2 ? "🥈 2nd Place" : "🥉 3rd Place"}
                        </div>
                        <div style={{ marginTop: "4px" }}>Player: {walletText}</div>
                        <div>Score: {scoreText} ⭐</div>
                        {w.isBot && <div style={{ fontSize: "10px", fontStyle: "italic" }}>(Bot)</div>}
                      </div>

                      {/* Avatar + chat bubble anchor */}
                      <div
                        style={{
                          position: "relative",
                          width: STAGE_W,
                          height: STAGE_H,
                        }}
                      >
                        {showChat && (
                          <div className="chat-bubble" title="Message is visible by others">
                            {w.chatText}
                          </div>
                        )}

                        <WinnerOutfitDisplay outfit={w.outfit} />
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* RIGHT PANEL */}
            <aside
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                alignItems: "stretch",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    borderRadius: 16,
                    padding: "12px 12px",
                    background: "rgba(255,155,227,0.20)",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: "rgba(36,12,58,0.92)",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontSize: 12,
                  }}
                >
                  Chat for lobby:
                </div>

                <div className="lobby-chatbar" style={{ maxWidth: "100%", marginTop: -2 }}>
                  <input
                    className="lobby-chat-input"
                    placeholder="Write message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={onChatKeyDown}
                    disabled={!account}
                  />
                  <button
                    className="btn small lobby-chat-send"
                    onClick={sendChat}
                    disabled={!account}
                  >
                    Send
                  </button>
                </div>

                {status && <div className="status-bar">{status}</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button className="btn primary" onClick={handleLeaveRoom}>
                  BACK TO LOBBY
                </button>
                
                <button className="btn outline" onClick={handleBackToStart}>
                  BACK TO START PAGE
                </button>
                
                <div style={{
                  fontSize: "11px",
                  color: "rgba(36,12,58,0.6)",
                  textAlign: "center",
                  marginTop: "10px",
                  padding: "8px",
                  background: "rgba(255,255,255,0.5)",
                  borderRadius: "8px"
                }}>
                  Room ID: {roomId}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}