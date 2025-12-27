// src/components/OutfitStage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Renders outfit on a stage using body bbox scanning + anchor rules (Nasiba-style).
 * Props:
 * - outfit: { body, hair, shoes, up, down, dress, hairclips, headphones, necklace, stockings, socks }
 * - width / height: stage size in px
 * - nameMaps: optional { up: Map(url->label), down:..., dress:..., shoes:... } for kind rules
 */
export default function OutfitStage({ outfit, width = 180, height = 300, nameMaps }) {
  const STAGE_W = width;
  const STAGE_H = height;

  // Z
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

  // NUDGE constants (tuned for 1704x3446 bodies)
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

  const cacheRef = useRef({
    metaByBody: new Map(),
    sizeByUrl: new Map(),
  });

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

  const safeOutfit = outfit || {};

  function getLabel(url, groupKey) {
    if (!url) return "";
    const map = nameMaps?.[groupKey];
    return (map?.get(url) || "").toLowerCase();
  }

  const upKind = useMemo(() => {
    const name = getLabel(safeOutfit.up, "up");
    if (!name) return null;
    if (name.includes("shirt 2") || name.includes("shirt_2")) return "long";
    return "short";
  }, [safeOutfit.up, nameMaps]);

  const downKind = useMemo(() => {
    const name = getLabel(safeOutfit.down, "down");
    if (!name) return null;
    if (name.includes("jeans")) return "jeans";
    return "skirt";
  }, [safeOutfit.down, nameMaps]);

  const dressKind = useMemo(() => {
    const name = getLabel(safeOutfit.dress, "dress");
    if (!name) return null;
    if (name.includes("dress 2") || name.includes("dress_2")) return "sleeves";
    if (name.includes("sleeve") || name.includes("long")) return "sleeves";
    return "no_sleeves";
  }, [safeOutfit.dress, nameMaps]);

  const shoesKind = useMemo(() => {
    const name = getLabel(safeOutfit.shoes, "shoes");
    if (!name) return null;
    if (name.includes("shoes 3") || name.includes("shoes_3")) return "long";
    if (name.includes("boot") || name.includes("long")) return "long";
    return "short";
  }, [safeOutfit.shoes, nameMaps]);

  const shoesZ = useMemo(() => {
    if (safeOutfit.dress) return Z_SHOES_OVER_ALL;
    if (!safeOutfit.down) return Z_SHOES_OVER_ALL;
    if (downKind !== "jeans") return Z_SHOES_OVER_ALL;
    return Z_SHOES_UNDER_PANTS;
  }, [safeOutfit.dress, safeOutfit.down, downKind]);

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function getSize(url) {
    if (!url) return null;
    const cached = cacheRef.current.sizeByUrl.get(url);
    if (cached) return cached;
    const img = await loadImage(url);
    const s = { w: img.naturalWidth, h: img.naturalHeight };
    cacheRef.current.sizeByUrl.set(url, s);
    return s;
  }

  async function scanBodyMeta(bodyUrl) {
    const cached = cacheRef.current.metaByBody.get(bodyUrl);
    if (cached) return cached;

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

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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

      return { left: x0 + minX, right: x0 + maxX, top: y0 + minY, bottom: y0 + maxY };
    }

    const head =
      scanRegionBBox(Math.floor(w * 0.35), 0, Math.floor(w * 0.68), Math.floor(h * 0.18)) ?? {
        left: w * 0.45,
        right: w * 0.65,
        top: 0,
        bottom: h * 0.12,
      };

    const torso =
      scanRegionBBox(Math.floor(w * 0.3), Math.floor(h * 0.16), Math.floor(w * 0.7), Math.floor(h * 0.55)) ?? {
        left: w * 0.38,
        right: w * 0.62,
        top: h * 0.2,
        bottom: h * 0.55,
      };

    const hips =
      scanRegionBBox(Math.floor(w * 0.3), Math.floor(h * 0.3), Math.floor(w * 0.7), Math.floor(h * 0.66)) ?? {
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

    const meta = { bodyW: w, bodyH: h, head, torso, hips, lower };
    cacheRef.current.metaByBody.set(bodyUrl, meta);
    return meta;
  }

  // load body meta
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!safeOutfit.body) return setBodyMeta(null);
      try {
        const meta = await scanBodyMeta(safeOutfit.body);
        if (alive) setBodyMeta(meta);
      } catch {
        if (alive) setBodyMeta(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [safeOutfit.body]);

  // load sizes for currently used items
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = { ...sizes };

      next.hair = await getSize(safeOutfit.hair);
      next.shoes = await getSize(safeOutfit.shoes);
      next.up = await getSize(safeOutfit.up);
      next.down = await getSize(safeOutfit.down);
      next.dress = await getSize(safeOutfit.dress);

      next.hairclips = await getSize(safeOutfit.hairclips);
      next.headphones = await getSize(safeOutfit.headphones);
      next.necklace = await getSize(safeOutfit.necklace);
      next.stockings = await getSize(safeOutfit.stockings);
      next.socks = await getSize(safeOutfit.socks);

      if (alive) setSizes(next);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    safeOutfit.hair,
    safeOutfit.shoes,
    safeOutfit.up,
    safeOutfit.down,
    safeOutfit.dress,
    safeOutfit.hairclips,
    safeOutfit.headphones,
    safeOutfit.necklace,
    safeOutfit.stockings,
    safeOutfit.socks,
  ]);

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
  }, [bodyMeta, sizes.hair, STAGE_W, STAGE_H]);

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
    if (!safeOutfit.hairclips || !bodyMeta?.head || !sizes.hairclips) return null;
    const head = bodyMeta.head;
    const headH = Math.max(1, head.bottom - head.top);
    const yBase = head.top - headH * 0.1;

    return (
      <AnchorToBBox
        src={safeOutfit.hairclips}
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
    if (!safeOutfit.headphones || !bodyMeta?.head || !sizes.headphones) return null;
    const head = bodyMeta.head;
    const headH = Math.max(1, head.bottom - head.top);
    const yBase = head.top - headH * 0.08;

    return (
      <AnchorToBBox
        src={safeOutfit.headphones}
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
    if (!safeOutfit.necklace || !bodyMeta?.torso || !sizes.necklace) return null;
    const torso = bodyMeta.torso;
    const torsoH = Math.max(1, torso.bottom - torso.top);
    const yBase = torso.top + torsoH * 0.08;

    return (
      <AnchorToBBox
        src={safeOutfit.necklace}
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
    if (!safeOutfit.stockings || !bodyMeta?.lower || !sizes.stockings) return null;
    const lower = bodyMeta.lower;
    const yBase = lower.top;

    return (
      <AnchorToBBox
        src={safeOutfit.stockings}
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
    if (!safeOutfit.socks || !bodyMeta?.lower || !sizes.socks) return null;
    const lower = bodyMeta.lower;
    const yBase = lower.top;

    return (
      <AnchorToBBox
        src={safeOutfit.socks}
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
          <FullLayer src={safeOutfit.body} z={Z_BODY} />

          {safeOutfit.dress ? (
            <>
              <StockingsLayer />
              <SocksLayer />
              <DressLayer src={safeOutfit.dress} kind={dressKind} z={Z_DRESS} />
            </>
          ) : (
            <>
              <DownLayer src={safeOutfit.down} kind={downKind} z={Z_DOWN} />
              <StockingsLayer />
              <SocksLayer />
              <UpLayer src={safeOutfit.up} kind={upKind} z={Z_UP} />
            </>
          )}

          <NecklaceLayer />
          <HairLayer src={safeOutfit.hair} z={Z_HAIR} />
          <HairclipsLayer />
          <HeadphonesLayer />
          <ShoesLayer src={safeOutfit.shoes} kind={shoesKind} z={shoesZ} />
        </div>
      ) : null}
    </div>
  );
}
