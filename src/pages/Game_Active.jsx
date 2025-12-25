// src/pages/Game_Active.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main_page.css";

import iconAccessories from "../assets/icons/accessories.png";
import iconAppearance from "../assets/icons/appearence.png";
import iconBottom from "../assets/icons/bottom.png";
import iconDress from "../assets/icons/dress.png";
import iconShoes from "../assets/icons/shoes.png";
import iconUp from "../assets/icons/up.png";

/**
 * Auto-load png assets (Vite).
 * Paths are relative to: src/pages/Game_Active.jsx
 */
const BODY_MAP = import.meta.glob("../assets/characters/*.png", {
  eager: true,
  import: "default",
});
const HAIR_MAP = import.meta.glob("../assets/face/hair/*.png", {
  eager: true,
  import: "default",
});
const SHOES_MAP = import.meta.glob("../assets/shoes/*.png", {
  eager: true,
  import: "default",
});
const UP_MAP = import.meta.glob("../assets/clothes/up/*.png", {
  eager: true,
  import: "default",
});
const DOWN_MAP = import.meta.glob("../assets/clothes/down/*.png", {
  eager: true,
  import: "default",
});
const DRESS_MAP = import.meta.glob("../assets/clothes/dress/*.png", {
  eager: true,
  import: "default",
});

/**
 * Accessories:
 * - supports both flat:   src/assets/accessories/*.png
 * - and nested folders:   src/assets/accessories/<type>/*.png
 */
const ACCESSORIES_MAP = import.meta.glob("../assets/accessories/**/*.png", {
  eager: true,
  import: "default",
});

function shortenAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function fileLabelFromKey(key) {
  const base = key.split("/").pop() || key;
  return base.replace(/\.png$/i, "");
}

function numFromLabel(label) {
  const m = label.match(/(\d+)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizePrettyName(label) {
  return label.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function buildAssetList(mapObj, customSorter) {
  const arr = Object.entries(mapObj).map(([key, url]) => {
    const label = fileLabelFromKey(key);
    return { key, url, label, pretty: normalizePrettyName(label) };
  });

  if (customSorter) return arr.sort(customSorter);

  return arr.sort((a, b) => {
    const an = numFromLabel(a.label);
    const bn = numFromLabel(b.label);
    if (an !== bn) return an - bn;
    return a.label.localeCompare(b.label);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Scan BODY alpha to get head bbox + torso bbox + hips bbox + lower bbox (in BODY pixel coords).
 */
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

  const head =
    scanRegionBBox(Math.floor(w * 0.35), 0, Math.floor(w * 0.68), Math.floor(h * 0.18)) ?? {
      left: w * 0.45,
      right: w * 0.65,
      top: 0,
      bottom: h * 0.12,
    };

  const torso =
    scanRegionBBox(Math.floor(w * 0.30), Math.floor(h * 0.16), Math.floor(w * 0.70), Math.floor(h * 0.55)) ?? {
      left: w * 0.38,
      right: w * 0.62,
      top: h * 0.2,
      bottom: h * 0.55,
    };

  const hips =
    scanRegionBBox(Math.floor(w * 0.30), Math.floor(h * 0.30), Math.floor(w * 0.70), Math.floor(h * 0.66)) ?? {
      left: w * 0.38,
      right: w * 0.62,
      top: h * 0.33,
      bottom: h * 0.62,
    };

  const lower =
    scanRegionBBox(Math.floor(w * 0.25), Math.floor(h * 0.42), Math.floor(w * 0.75), Math.floor(h * 0.98)) ?? {
      left: w * 0.35,
      right: w * 0.65,
      top: h * 0.45,
      bottom: h * 0.98,
    };

  return { bodyW: w, bodyH: h, head, torso, hips, lower };
}

function detectAccessoryType(assetKey, pretty) {
  const k = (assetKey || "").toLowerCase();
  const p = (pretty || "").toLowerCase();
  const has = (s) => k.includes(s) || p.includes(s);

  if (has("/hairclips/") || has("hairclip") || has("clip")) return "hairclips";
  if (has("/headphones/") || has("headphone") || has("headphones")) return "headphones";
  if (has("/necklace/") || has("necklace")) return "necklace";
  if (has("/stockings/") || has("stocking") || has("stockings")) return "stockings";
  if (has("/socks/") || has("sock") || has("socks")) return "socks";
  return "misc";
}

export default function GameActive() {
  const navigate = useNavigate();
  const { roomId } = useParams(); // ✅ room from /active/:roomId

  // ======================
  // TUNING CONSTANTS
  // ======================
  const STAGE_W = 260;
  const STAGE_H = 420;

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

  // ======================
  // State
  // ======================
  const [account, setAccount] = useState(null);
  const [topic, setTopic] = useState("—");
  const [timeLeft, setTimeLeft] = useState(120);
  const [status, setStatus] = useState("");

  // ✅ take topic from localStorage by roomId if exists (optional)
  useEffect(() => {
    if (!roomId) return;
    try {
      const raw = localStorage.getItem(`dc_room_${roomId}`);
      if (!raw) return;
      const meta = JSON.parse(raw);
      if (meta?.topic) setTopic(meta.topic);
    } catch {}
  }, [roomId]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0) setStatus("Время вышло. Образ зафиксирован/ожидание (логика будет позже).");
  }, [timeLeft]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Установи MetaMask, чтобы подключить кошелек.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      setStatus("Кошелек подключен.");
    } catch (err) {
      console.error(err);
      setStatus("Подключение отменено.");
    }
  }

  const timeIsUp = timeLeft <= 0;

  // Build asset lists
  const assets = useMemo(() => {
    const bodies = buildAssetList(BODY_MAP);
    const hairs = buildAssetList(HAIR_MAP, (a, b) => {
      const order = ["Black", "Blonde", "Brunette", "Pink"];
      const ai = order.findIndex((x) => a.label.includes(x));
      const bi = order.findIndex((x) => b.label.includes(x));
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.label.localeCompare(b.label);
    });
    const shoes = buildAssetList(SHOES_MAP);
    const up = buildAssetList(UP_MAP);
    const down = buildAssetList(DOWN_MAP);
    const dress = buildAssetList(DRESS_MAP);

    const accessoriesAll = buildAssetList(ACCESSORIES_MAP);
    const accessories = { hairclips: [], headphones: [], necklace: [], stockings: [], socks: [], misc: [] };
    for (const it of accessoriesAll) {
      const t = detectAccessoryType(it.key, it.pretty);
      accessories[t].push(it);
    }

    return { bodies, hairs, shoes, up, down, dress, accessories };
  }, []);

  // url -> pretty name maps (for kind detection)
  const downNameByUrl = useMemo(() => new Map(assets.down.map((it) => [it.url, it.pretty])), [assets.down]);
  const upNameByUrl = useMemo(() => new Map(assets.up.map((it) => [it.url, it.pretty])), [assets.up]);
  const dressNameByUrl = useMemo(() => new Map(assets.dress.map((it) => [it.url, it.pretty])), [assets.dress]);
  const shoesNameByUrl = useMemo(() => new Map(assets.shoes.map((it) => [it.url, it.pretty])), [assets.shoes]);

  // Selected outfit (store URLs)
  const [selected, setSelected] = useState(() => ({
    body: assets.bodies?.[0]?.url ?? null,
    hair: assets.hairs?.[0]?.url ?? null,
    shoes: null,
    up: null,
    down: null,
    dress: null,
    hairclips: null,
    headphones: null,
    necklace: null,
    stockings: null,
    socks: null,
  }));

  useEffect(() => {
    setSelected((prev) => ({
      body: prev.body ?? assets.bodies?.[0]?.url ?? null,
      hair: prev.hair ?? assets.hairs?.[0]?.url ?? null,
      shoes: prev.shoes ?? null,
      up: prev.up ?? null,
      down: prev.down ?? null,
      dress: prev.dress ?? null,
      hairclips: prev.hairclips ?? null,
      headphones: prev.headphones ?? null,
      necklace: prev.necklace ?? null,
      stockings: prev.stockings ?? null,
      socks: prev.socks ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.bodies?.length, assets.hairs?.length]);

  const [panel, setPanel] = useState("appearance");

  function pickBody(url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, body: url }));
  }
  function pickHair(url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, hair: url }));
  }
  function pickShoes(url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, shoes: prev.shoes === url ? null : url }));
  }
  function pickUp(url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, up: prev.up === url ? null : url, dress: null }));
  }
  function pickDown(url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, down: prev.down === url ? null : url, dress: null }));
  }
  function pickDress(url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, dress: prev.dress === url ? null : url, up: null, down: null }));
  }
  function pickAccessory(type, url) {
    if (timeIsUp) return;
    setSelected((prev) => ({ ...prev, [type]: prev[type] === url ? null : url }));
  }

  function handleSubmitOutfit() {
    if (!account) return setStatus("Сначала подключи кошелек.");
    if (timeIsUp) return setStatus("Время вышло — изменить/сохранить нельзя.");
    setStatus("Образ сохранён. Ждём остальных игроков...");
    console.log("SUBMIT OUTFIT:", { roomId, selected });
  }

  const outfitText = useMemo(() => {
    const parts = [];
    if (selected.body) parts.push("Body");
    if (selected.hair) parts.push("Hair");
    if (selected.shoes) parts.push("Shoes");
    if (selected.dress) parts.push("Dress");
    else {
      if (selected.up) parts.push("Up");
      if (selected.down) parts.push("Down");
    }
    if (selected.hairclips) parts.push("Hairclips");
    if (selected.headphones) parts.push("Headphones");
    if (selected.necklace) parts.push("Necklace");
    if (selected.stockings) parts.push("Stockings");
    if (selected.socks) parts.push("Socks");
    return parts.length ? parts.join(" • ") : "Выбери вещи справа, чтобы собрать образ.";
  }, [selected]);

  // ===========================
  // Scan + caches
  // ===========================
  const metaCacheRef = useRef(new Map());
  const sizeCacheRef = useRef(new Map());

  const [bodyMeta, setBodyMeta] = useState(null);

  const [hairSize, setHairSize] = useState(null);
  const [upSize, setUpSize] = useState(null);
  const [downSize, setDownSize] = useState(null);
  const [dressSize, setDressSize] = useState(null);
  const [shoesSize, setShoesSize] = useState(null);

  const [accSizes, setAccSizes] = useState({
    hairclips: null,
    headphones: null,
    necklace: null,
    stockings: null,
    socks: null,
  });

  async function getSizeCached(url) {
    if (!url) return null;
    if (sizeCacheRef.current.has(url)) return sizeCacheRef.current.get(url);
    const img = await loadImage(url);
    const size = { w: img.naturalWidth, h: img.naturalHeight };
    sizeCacheRef.current.set(url, size);
    return size;
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!selected.body) return;

      if (metaCacheRef.current.has(selected.body)) {
        if (!cancelled) setBodyMeta(metaCacheRef.current.get(selected.body));
        return;
      }

      try {
        const meta = await scanBodyMeta(selected.body);
        metaCacheRef.current.set(selected.body, meta);
        if (!cancelled) setBodyMeta(meta);
      } catch (e) {
        console.error("scanBodyMeta error:", e);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selected.body]);

  useEffect(() => {
    let cancelled = false;
    getSizeCached(selected.hair).then((s) => !cancelled && setHairSize(s)).catch(() => !cancelled && setHairSize(null));
    return () => (cancelled = true);
  }, [selected.hair]);

  useEffect(() => {
    let cancelled = false;
    getSizeCached(selected.up).then((s) => !cancelled && setUpSize(s)).catch(() => !cancelled && setUpSize(null));
    return () => (cancelled = true);
  }, [selected.up]);

  useEffect(() => {
    let cancelled = false;
    getSizeCached(selected.down).then((s) => !cancelled && setDownSize(s)).catch(() => !cancelled && setDownSize(null));
    return () => (cancelled = true);
  }, [selected.down]);

  useEffect(() => {
    let cancelled = false;
    getSizeCached(selected.dress).then((s) => !cancelled && setDressSize(s)).catch(() => !cancelled && setDressSize(null));
    return () => (cancelled = true);
  }, [selected.dress]);

  useEffect(() => {
    let cancelled = false;
    getSizeCached(selected.shoes).then((s) => !cancelled && setShoesSize(s)).catch(() => !cancelled && setShoesSize(null));
    return () => (cancelled = true);
  }, [selected.shoes]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const next = { hairclips: null, headphones: null, necklace: null, stockings: null, socks: null };
      try {
        next.hairclips = await getSizeCached(selected.hairclips);
        next.headphones = await getSizeCached(selected.headphones);
        next.necklace = await getSizeCached(selected.necklace);
        next.stockings = await getSizeCached(selected.stockings);
        next.socks = await getSizeCached(selected.socks);
      } catch {}
      if (!cancelled) setAccSizes(next);
    }
    run();
    return () => (cancelled = true);
  }, [selected.hairclips, selected.headphones, selected.necklace, selected.stockings, selected.socks]);

  // ===========================
  // KIND detectors
  // ===========================
  const downKind = useMemo(() => {
    if (!selected.down) return null;
    const name = (downNameByUrl.get(selected.down) || "").toLowerCase();
    if (name.includes("jeans")) return "jeans";
    return "skirt";
  }, [selected.down, downNameByUrl]);

  const upKind = useMemo(() => {
    if (!selected.up) return null;
    const name = (upNameByUrl.get(selected.up) || "").toLowerCase();
    if (name.includes("shirt 2") || name.includes("shirt_2")) return "long";
    return "short";
  }, [selected.up, upNameByUrl]);

  const dressKind = useMemo(() => {
    if (!selected.dress) return null;
    const name = (dressNameByUrl.get(selected.dress) || "").toLowerCase();
    if (name.includes("sleeve") || name.includes("long")) return "sleeves";
    if (name.includes("dress 2") || name.includes("dress_2")) return "sleeves";
    return "no_sleeves";
  }, [selected.dress, dressNameByUrl]);

  const shoesKind = useMemo(() => {
    if (!selected.shoes) return null;
    const name = (shoesNameByUrl.get(selected.shoes) || "").toLowerCase();
    if (name.includes("boot") || name.includes("boots") || name.includes("long")) return "long";
    if (name.includes("shoes 3") || name.includes("shoes_3")) return "long";
    return "short";
  }, [selected.shoes, shoesNameByUrl]);

  const shoesZ = useMemo(() => {
    if (selected.dress) return Z_SHOES_OVER_ALL;
    if (!selected.down) return Z_SHOES_OVER_ALL;
    if (downKind !== "jeans") return Z_SHOES_OVER_ALL;
    return Z_SHOES_UNDER_PANTS;
  }, [selected.dress, selected.down, downKind]);

  // ===========================
  // Stage layout
  // ===========================
  const stageLayout = useMemo(() => {
    if (!bodyMeta) return null;
    const { bodyW, bodyH, head } = bodyMeta;

    const scale = Math.min(STAGE_W / bodyW, STAGE_H / bodyH);
    const scaledW = bodyW * scale;
    const scaledH = bodyH * scale;
    const artLeft = (STAGE_W - scaledW) / 2;
    const artTop = (STAGE_H - scaledH) / 2;

    let hairPos = null;
    if (hairSize && head) {
      const headCx = (head.left + head.right) / 2;
      const headTop = head.top;

      const hx = Math.round(headCx - hairSize.w / 2 + HAIR_X_NUDGE);
      const hy = Math.round(headTop - hairSize.h * 0.08 + HAIR_Y_NUDGE);
      hairPos = { x: hx, y: hy, s: 1 };
    }

    return { scale, artLeft, artTop, bodyW, bodyH, hairPos };
  }, [bodyMeta, hairSize, STAGE_W, STAGE_H, HAIR_X_NUDGE, HAIR_Y_NUDGE]);

  // ===========================
  // Render helpers
  // ===========================
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

  function HairLayer({ src, z }) {
    if (!src || !stageLayout?.hairPos || !hairSize) return null;
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
          width: hairSize.w * s,
          height: hairSize.h * s,
          zIndex: z,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    );
  }

  function AnchorToBBox({ src, size, bbox, widthFactor, xNudge, yNudge, yBase, z }) {
    if (!src || !size || !bbox) return null;
    const bw = Math.max(1, bbox.right - bbox.left);
    const cx = (bbox.left + bbox.right) / 2;

    const targetW = bw * widthFactor;
    const scale = targetW / size.w;

    const x0 = cx - (size.w * scale) / 2 + xNudge;
    const y0 = yBase + yNudge;

    return <ScaledLayer src={src} x={x0} y={y0} w={size.w} h={size.h} scale={scale} z={z} />;
  }

  function UpLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.torso || !upSize || !kind) return null;
    const torso = bodyMeta.torso;
    const isLong = kind === "long";

    const widthFactor = isLong ? UP_LONG_WIDTH_FACTOR : UP_SHORT_WIDTH_FACTOR;
    const xNudge = isLong ? UP_LONG_X_NUDGE : UP_SHORT_X_NUDGE;
    const yNudge = isLong ? UP_LONG_Y_NUDGE : UP_SHORT_Y_NUDGE;

    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top - torsoH * 0.1;

    return <AnchorToBBox src={src} size={upSize} bbox={torso} widthFactor={widthFactor} xNudge={xNudge} yNudge={yNudge} yBase={yBase} z={z} />;
  }

  function DownLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.hips || !downSize || !kind) return null;
    const hips = bodyMeta.hips;
    const isJeans = kind === "jeans";

    const widthFactor = isJeans ? JEANS_WIDTH_FACTOR : SKIRT_WIDTH_FACTOR;
    const xNudge = isJeans ? JEANS_X_NUDGE : SKIRT_X_NUDGE;
    const yNudge = isJeans ? JEANS_Y_NUDGE : SKIRT_Y_NUDGE;

    const yBase = hips.top;

    return <AnchorToBBox src={src} size={downSize} bbox={hips} widthFactor={widthFactor} xNudge={xNudge} yNudge={yNudge} yBase={yBase} z={z} />;
  }

  function DressLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.torso || !dressSize || !kind) return null;
    const torso = bodyMeta.torso;
    const isSleeves = kind === "sleeves";

    const widthFactor = isSleeves ? DRESS_SLEEVES_WIDTH_FACTOR : DRESS_NO_SLEEVES_WIDTH_FACTOR;
    const xNudge = isSleeves ? DRESS_SLEEVES_X_NUDGE : DRESS_NO_SLEEVES_X_NUDGE;
    const yNudge = isSleeves ? DRESS_SLEEVES_Y_NUDGE : DRESS_NO_SLEEVES_Y_NUDGE;

    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top - torsoH * 0.12;

    return <AnchorToBBox src={src} size={dressSize} bbox={torso} widthFactor={widthFactor} xNudge={xNudge} yNudge={yNudge} yBase={yBase} z={z} />;
  }

  function ShoesLayer({ src, z, kind }) {
    if (!src || !bodyMeta?.lower || !shoesSize || !kind) return null;
    const lower = bodyMeta.lower;
    const isLong = kind === "long";

    const widthFactor = isLong ? SHOES_LONG_WIDTH_FACTOR : SHOES_SHORT_WIDTH_FACTOR;
    const xNudge = isLong ? SHOES_LONG_X_NUDGE : SHOES_SHORT_X_NUDGE;
    const yNudge = isLong ? SHOES_LONG_Y_NUDGE : SHOES_SHORT_Y_NUDGE;

    const yBase = lower.top;

    return <AnchorToBBox src={src} size={shoesSize} bbox={lower} widthFactor={widthFactor} xNudge={xNudge} yNudge={yNudge} yBase={yBase} z={z} />;
  }

  function HairclipsLayer() {
    if (!selected.hairclips || !bodyMeta?.head || !accSizes.hairclips) return null;
    const head = bodyMeta.head;
    const headH = Math.max(1, head.bottom - head.top);
    const yBase = head.top - headH * 0.1;

    return <AnchorToBBox src={selected.hairclips} size={accSizes.hairclips} bbox={head} widthFactor={HAIRCLIPS_WIDTH_FACTOR} xNudge={HAIRCLIPS_X_NUDGE} yNudge={HAIRCLIPS_Y_NUDGE} yBase={yBase} z={Z_HEAD_ACCESSORY} />;
  }

  function HeadphonesLayer() {
    if (!selected.headphones || !bodyMeta?.head || !accSizes.headphones) return null;
    const head = bodyMeta.head;
    const headH = Math.max(1, head.bottom - head.top);
    const yBase = head.top - headH * 0.08;

    return <AnchorToBBox src={selected.headphones} size={accSizes.headphones} bbox={head} widthFactor={HEADPHONES_WIDTH_FACTOR} xNudge={HEADPHONES_X_NUDGE} yNudge={HEADPHONES_Y_NUDGE} yBase={yBase} z={Z_HEAD_ACCESSORY} />;
  }

  function NecklaceLayer() {
    if (!selected.necklace || !bodyMeta?.torso || !accSizes.necklace) return null;
    const torso = bodyMeta.torso;
    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top + torsoH * 0.08;

    return <AnchorToBBox src={selected.necklace} size={accSizes.necklace} bbox={torso} widthFactor={NECKLACE_WIDTH_FACTOR} xNudge={NECKLACE_X_NUDGE} yNudge={NECKLACE_Y_NUDGE} yBase={yBase} z={Z_NECKLACE} />;
  }

  function StockingsLayer() {
    if (!selected.stockings || !bodyMeta?.lower || !accSizes.stockings) return null;
    const lower = bodyMeta.lower;
    const yBase = lower.top;

    return <AnchorToBBox src={selected.stockings} size={accSizes.stockings} bbox={lower} widthFactor={STOCKINGS_WIDTH_FACTOR} xNudge={STOCKINGS_X_NUDGE} yNudge={STOCKINGS_Y_NUDGE} yBase={yBase} z={Z_STOCKINGS} />;
  }

  function SocksLayer() {
    if (!selected.socks || !bodyMeta?.lower || !accSizes.socks) return null;
    const lower = bodyMeta.lower;
    const yBase = lower.top;

    return <AnchorToBBox src={selected.socks} size={accSizes.socks} bbox={lower} widthFactor={SOCKS_WIDTH_FACTOR} xNudge={SOCKS_X_NUDGE} yNudge={SOCKS_Y_NUDGE} yBase={yBase} z={Z_SOCKS} />;
  }

  // ===========================
  // Wardrobe UI (unchanged)
  // ===========================
  function WardrobeGrid({ title, items, selectedUrl, onPick }) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(0,0,0,0.06)",
            color: "rgba(36, 12, 58, 0.92)",
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {title}
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {items.map((it) => {
              const isSel = selectedUrl === it.url;
              return (
                <button
                  key={it.key}
                  onClick={() => onPick(it.url)}
                  disabled={timeIsUp}
                  title={it.pretty}
                  style={{
                    borderRadius: 16,
                    border: isSel ? "1px solid rgba(255, 77, 166, 0.65)" : "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(255,255,255,0.78)",
                    cursor: timeIsUp ? "not-allowed" : "pointer",
                    padding: 10,
                    display: "grid",
                    gap: 8,
                    boxShadow: isSel ? "0 10px 22px rgba(255, 77, 166, 0.18)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.6)",
                      border: "1px dashed rgba(36, 12, 58, 0.20)",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    <img src={it.url} alt={it.pretty} style={{ width: "100%", height: "100%", objectFit: "contain" }} draggable={false} />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(36,12,58,0.75)",
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.1,
                    }}
                  >
                    {it.pretty}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function WardrobeAppearance() {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", gap: 12 }}>
        <div style={{ height: "50%", minHeight: 200 }}>
          <WardrobeGrid title="Skin (Body)" items={assets.bodies} selectedUrl={selected.body} onPick={pickBody} />
        </div>
        <div style={{ height: "50%", minHeight: 200 }}>
          <WardrobeGrid title="Hair color" items={assets.hairs} selectedUrl={selected.hair} onPick={pickHair} />
        </div>
      </div>
    );
  }

  function WardrobeAccessories() {
    return (
      <div style={{ width: "100%", height: "100%", overflowY: "auto", paddingRight: 6, display: "grid", gap: 12 }}>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid title="Hairclips" items={assets.accessories.hairclips} selectedUrl={selected.hairclips} onPick={(url) => pickAccessory("hairclips", url)} />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid title="Headphones" items={assets.accessories.headphones} selectedUrl={selected.headphones} onPick={(url) => pickAccessory("headphones", url)} />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid title="Necklace" items={assets.accessories.necklace} selectedUrl={selected.necklace} onPick={(url) => pickAccessory("necklace", url)} />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid title="Stockings" items={assets.accessories.stockings} selectedUrl={selected.stockings} onPick={(url) => pickAccessory("stockings", url)} />
        </div>
        <div style={{ minHeight: 240 }}>
          <WardrobeGrid title="Socks" items={assets.accessories.socks} selectedUrl={selected.socks} onPick={(url) => pickAccessory("socks", url)} />
        </div>
      </div>
    );
  }

  const wardrobeContent = useMemo(() => {
    if (panel === "appearance") return <WardrobeAppearance />;
    if (panel === "shoes") return <WardrobeGrid title="Shoes" items={assets.shoes} selectedUrl={selected.shoes} onPick={pickShoes} />;
    if (panel === "up") return <WardrobeGrid title="Up" items={assets.up} selectedUrl={selected.up} onPick={pickUp} />;
    if (panel === "down") return <WardrobeGrid title="Down" items={assets.down} selectedUrl={selected.down} onPick={pickDown} />;
    if (panel === "dress") return <WardrobeGrid title="Dress" items={assets.dress} selectedUrl={selected.dress} onPick={pickDress} />;
    return <WardrobeAccessories />;
  }, [panel, assets, selected, timeIsUp]);

  return (
    <div className="start-root">
      <div className="glow-circle glow-1" />
      <div className="glow-circle glow-2" />

      <header className="start-header">
        <div className="brand">
          <span className="brand-mark">★</span>
          <span className="brand-name">DressChain</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn outline small" onClick={() => navigate(`/lobby/${roomId}`)}>
            ← Back to Lobby
          </button>

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
        </div>
      </header>

      <main className="active-main">
        <section className="active-card">
          <div className="active-top">
            {/* LEFT */}
            <div className="active-leftTop">
              <div className="active-topicBubble">
                <div className="active-bubbleTitle">I need to dress in style</div>
                <div className="active-bubbleText">[{topic}]</div>
                <div className="active-bubbleText" style={{ opacity: 0.7 }}>
                  Room: {roomId}
                </div>
              </div>

              <div className="active-avatarWrap">
                <div
                  style={{
                    width: STAGE_W,
                    height: STAGE_H,
                    position: "relative",
                    borderRadius: 18,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.35)",
                    border: "1px dashed rgba(36, 12, 58, 0.25)",
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
                      <FullLayer src={selected.body} z={Z_BODY} />

                      {selected.dress ? (
                        <>
                          <StockingsLayer />
                          <SocksLayer />
                          <DressLayer src={selected.dress} kind={dressKind} z={Z_DRESS} />
                        </>
                      ) : (
                        <>
                          <DownLayer src={selected.down} kind={downKind} z={Z_DOWN} />
                          <StockingsLayer />
                          <SocksLayer />
                          <UpLayer src={selected.up} kind={upKind} z={Z_UP} />
                        </>
                      )}

                      <NecklaceLayer />
                      <HairLayer src={selected.hair} z={Z_HAIR} />
                      <HairclipsLayer />
                      <HeadphonesLayer />
                      <ShoesLayer src={selected.shoes} kind={shoesKind} z={shoesZ} />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="active-miniProfile">
                <img className="active-miniImg" src={selected.body ?? assets.bodies?.[0]?.url} alt="player" />
                <div className="active-miniText">
                  <div className="active-miniLabel">ROOM</div>
                  <div className="active-miniValue">{roomId}</div>
                </div>
              </div>
            </div>

            {/* CENTER */}
            <div className="active-wardrobe">
              <div className="active-wardrobeFrame">
                <div className="active-wardrobePlaceholder" />
                <div style={{ position: "absolute", inset: 10, borderRadius: 18, padding: 10, overflow: "hidden" }}>
                  {wardrobeContent}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="active-rightPanel">
              <button className="btn outline small" onClick={connectWallet}>
                {account ? "Кошелек подключен" : "Подключить кошелек"}
              </button>

              <div className="active-items">
                <button className={`active-item ${panel === "appearance" ? "selected" : ""}`} onClick={() => setPanel("appearance")} disabled={timeIsUp}>
                  <div className="active-itemIcon">
                    <img src={iconAppearance} alt="appearance" draggable={false} style={{ width: 26, height: 26, objectFit: "contain" }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "up" ? "selected" : ""}`} onClick={() => setPanel("up")} disabled={timeIsUp}>
                  <div className="active-itemIcon">
                    <img src={iconUp} alt="up" draggable={false} style={{ width: 26, height: 26, objectFit: "contain" }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "down" ? "selected" : ""}`} onClick={() => setPanel("down")} disabled={timeIsUp}>
                  <div className="active-itemIcon">
                    <img src={iconBottom} alt="bottom" draggable={false} style={{ width: 26, height: 26, objectFit: "contain" }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "dress" ? "selected" : ""}`} onClick={() => setPanel("dress")} disabled={timeIsUp}>
                  <div className="active-itemIcon">
                    <img src={iconDress} alt="dress" draggable={false} style={{ width: 26, height: 26, objectFit: "contain" }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "shoes" ? "selected" : ""}`} onClick={() => setPanel("shoes")} disabled={timeIsUp}>
                  <div className="active-itemIcon">
                    <img src={iconShoes} alt="shoes" draggable={false} style={{ width: 26, height: 26, objectFit: "contain" }} />
                  </div>
                </button>

                <button className={`active-item ${panel === "accessories" ? "selected" : ""}`} onClick={() => setPanel("accessories")} disabled={timeIsUp}>
                  <div className="active-itemIcon">
                    <img src={iconAccessories} alt="accessories" draggable={false} style={{ width: 26, height: 26, objectFit: "contain" }} />
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="active-bottom">
            <div className="active-outfitLine">{outfitText}</div>

            <div className={`active-timer ${timeIsUp ? "danger" : ""}`}>
              <span className="active-timerLabel">TIME LEFT: </span>
              <span className="active-timerValue">{formatMMSS(timeLeft)}</span>
            </div>

            <button className="btn primary" onClick={handleSubmitOutfit} disabled={timeIsUp}>
              Save outfit
            </button>
          </div>

          {status && <div className="status-bar">{status}</div>}
        </section>
      </main>
    </div>
  );
}
