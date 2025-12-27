// src/utils/outfitCodec.js

// Bit layout (low -> high):
// body(3), hair(3), shoes(3), up(3), down(3), dress(3), hairclips(2),
// headphones(2), necklace(2), stockings(2), socks(2)  => 28 bits total

const FIELDS = [
  { key: "body", bits: 3, required: true },
  { key: "hair", bits: 3, required: true },
  { key: "shoes", bits: 3, required: true },

  { key: "up", bits: 3, required: false },
  { key: "down", bits: 3, required: false },
  { key: "dress", bits: 3, required: false },

  { key: "hairclips", bits: 2, required: false },
  { key: "headphones", bits: 2, required: false },
  { key: "necklace", bits: 2, required: false },
  { key: "stockings", bits: 2, required: false },
  { key: "socks", bits: 2, required: false },
];

function idxByUrl(url, arr) {
  if (!url) return -1;
  return arr.findIndex((x) => x.url === url);
}

function toVal(url, arr, required) {
  const idx = idxByUrl(url, arr);
  if (idx < 0) return required ? 1 : 0; // required defaults to first item (val=1)
  return idx + 1; // reserve 0 for "none"
}

function fromVal(val, arr, required) {
  const n = Number(val);
  if (n === 0) return required ? (arr[0]?.url ?? null) : null;
  const i = n - 1;
  return arr[i]?.url ?? (required ? (arr[0]?.url ?? null) : null);
}

export function encodeOutfit(selected, assets) {
  let code = 0n;
  let shift = 0n;

  const lists = {
    body: assets.bodies,
    hair: assets.hairs,
    shoes: assets.shoes,
    up: assets.up,
    down: assets.down,
    dress: assets.dress,
    hairclips: assets.accessories.hairclips,
    headphones: assets.accessories.headphones,
    necklace: assets.accessories.necklace,
    stockings: assets.accessories.stockings,
    socks: assets.accessories.socks,
  };

  for (const f of FIELDS) {
    const arr = lists[f.key] || [];
    const v = toVal(selected[f.key], arr, f.required);
    const max = (1 << f.bits) - 1;
    const vv = Math.max(0, Math.min(max, Number(v)));
    code |= BigInt(vv) << shift;
    shift += BigInt(f.bits);
  }

  return code;
}

export function decodeOutfit(code, assets) {
  let x = BigInt(code ?? 0);
  let shift = 0n;

  const lists = {
    body: assets.bodies,
    hair: assets.hairs,
    shoes: assets.shoes,
    up: assets.up,
    down: assets.down,
    dress: assets.dress,
    hairclips: assets.accessories.hairclips,
    headphones: assets.accessories.headphones,
    necklace: assets.accessories.necklace,
    stockings: assets.accessories.stockings,
    socks: assets.accessories.socks,
  };

  const out = {};
  for (const f of FIELDS) {
    const mask = (1n << BigInt(f.bits)) - 1n;
    const v = (x >> shift) & mask;
    const arr = lists[f.key] || [];
    out[f.key] = fromVal(v, arr, f.required);
    shift += BigInt(f.bits);
  }

  return out;
}
