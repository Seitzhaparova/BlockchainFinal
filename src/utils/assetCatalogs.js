// src/utils/assetCatalogs.js

function baseName(path) {
  const file = path.split("/").pop() || path;
  return file.replace(/\.(png|jpg|jpeg|webp)$/i, "");
}

function prettyName(label) {
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortItems(items) {
  return items.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
  );
}

function toItems(mods) {
  const items = Object.entries(mods).map(([path, url]) => {
    const label = baseName(path);
    return {
      key: path,
      url,
      label,
      pretty: prettyName(label),
    };
  });
  return sortItems(items);
}

// Vite eager globs (stable ordering after sort)
const BODY_MODS = import.meta.glob("../assets/body/*.png", { eager: true, import: "default" });
const HAIR_MODS = import.meta.glob("../assets/face/hair/*.png", { eager: true, import: "default" });

const SHOES_MODS = import.meta.glob("../assets/shoes/*.png", { eager: true, import: "default" });

const UP_MODS = import.meta.glob("../assets/clothes/up/*.png", { eager: true, import: "default" });
const DOWN_MODS = import.meta.glob("../assets/clothes/down/*.png", { eager: true, import: "default" });
const DRESS_MODS = import.meta.glob("../assets/clothes/dress/*.png", { eager: true, import: "default" });

const ACC_MODS = import.meta.glob("../assets/accessories/*.png", { eager: true, import: "default" });

function filterAcc(all, includes) {
  return all.filter((it) => it.label.toLowerCase().includes(includes));
}

function makeMapByUrl(items) {
  return new Map(items.map((it) => [it.url, it.label]));
}

const allAcc = toItems(ACC_MODS);

export const ASSETS = {
  bodies: toItems(BODY_MODS),
  hairs: toItems(HAIR_MODS),
  shoes: toItems(SHOES_MODS),

  up: toItems(UP_MODS),
  down: toItems(DOWN_MODS),
  dress: toItems(DRESS_MODS),

  accessories: {
    hairclips: sortItems(filterAcc(allAcc, "hairclip")),
    headphones: sortItems(filterAcc(allAcc, "headphones")),
    necklace: sortItems(filterAcc(allAcc, "necklace")),
    stockings: sortItems(filterAcc(allAcc, "stockings")),
    socks: sortItems(filterAcc(allAcc, "socks")),
  },
};

export const NAME_MAPS = {
  body: makeMapByUrl(ASSETS.bodies),
  hair: makeMapByUrl(ASSETS.hairs),
  shoes: makeMapByUrl(ASSETS.shoes),
  up: makeMapByUrl(ASSETS.up),
  down: makeMapByUrl(ASSETS.down),
  dress: makeMapByUrl(ASSETS.dress),
  hairclips: makeMapByUrl(ASSETS.accessories.hairclips),
  headphones: makeMapByUrl(ASSETS.accessories.headphones),
  necklace: makeMapByUrl(ASSETS.accessories.necklace),
  stockings: makeMapByUrl(ASSETS.accessories.stockings),
  socks: makeMapByUrl(ASSETS.accessories.socks),
};
