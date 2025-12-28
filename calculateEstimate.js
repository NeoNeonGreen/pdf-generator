// calculateEstimate.js
"use strict";

/**
 * Формат числа для объема (запятая как в РФ).
 * @param {number} n
 * @param {number} digits
 */
function fmt(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * @param {any} v
 */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @param {string} msg
 */
function bad(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  throw e;
}

// -------------------- Константы из таблицы --------------------

// Проект
const PROJECT_PRICE = 300000; // 100к за раздел, итого 3 раздела

// Фундамент - плита
const SLAB_BETON_PRICE = 6500;  // ₽/м3
const SLAB_WORK_PRICE = 7000;   // ₽/м3
const SLAB_TECH_PRICE = 3700;   // ₽/м3
const SLAB_REBAR_PRICE = 60;    // ₽/кг
const SLAB_REBAR_KG_PER_M2 = 22;

// Фундамент - лента
const STRIP_BETON_PRICE = 6500; // ₽/м3
const STRIP_WORK_PRICE = 4000;  // ₽/м.п.
const STRIP_TECH_PRICE = 3700;  // ₽/м3
const STRIP_REBAR_PRICE = 60;   // ₽/кг
const STRIP_BETON_M3_PER_MP = 0.4;
const STRIP_REBAR_KG_PER_MP = 10;

// Металл
const METAL_PRICE_PER_TON = 90000;
const METAL_WORK_PER_TON = 95000; // изготовление+монтаж
const METAL_K_TON_PER_M2_1F = 0.042;
const METAL_K_TON_PER_M2_2F = 0.070;

// Стены
const WALL_WORK_PRICE = 1300; // ₽/м2
const WALL_COEF = 1.3;
const WALL_PANEL_PRICES = {
  sandwich: { 100: 2855, 120: 3055, 150: 3355 },
  pir: { 60: 2750, 100: 3350, 150: 4300 },
};

// Кровля
const ROOF_WORK_PRICE = 1300; // ₽/м2 (по таблице)
const ROOF_PANEL_PRICES = {
  sandwich: { 100: 3150, 150: 3650, 200: 4050 },
  membrane: 600,
};

// Ворота (цены уже "ворота + работа" по таблице)
const GATE_PRICES = {
  "3x2": 118000,
  "3x3": 157000,
  "3x4": 205000,
  "3x5": 256250,
  "4x5": 348000,
};

// Окна (цены уже "окно + монтаж")
const WINDOW_PRICES = {
  "1.2x2": 51600,
  "1.2x3": 77400,
  "1.2x5": 129000,
};

// Двери
const DOOR_PRICE = 80000;

// Итоговая наценка (предварительная стоимость)
const TOTAL_COEF = 1.2;

// -------------------- Расчет узлов --------------------

function calcSlab(length, width, thickness) {
  const L = toNum(length);
  const W = toNum(width);
  const T = toNum(thickness);

  if (!(L > 0) || !(W > 0)) bad("Некорректные длина/ширина для плиты.");
  if (![0.2, 0.3, 0.4].includes(T)) bad("Толщина плиты должна быть 0.2 / 0.3 / 0.4 м.");

  // Площадь плиты = Длина * Ширина * 110% (как в таблице)
  const area = L * W * 1.1;

  // Объем бетона = Площадь * толщина
  const betonM3 = area * T;

  // Стоимость плиты:
  // Площадь * толщина * (бетон + работы + техника) + Площадь * 22кг * цена арматуры
  const betonPart = betonM3 * (SLAB_BETON_PRICE + SLAB_WORK_PRICE + SLAB_TECH_PRICE);
  const rebarKg = area * SLAB_REBAR_KG_PER_M2;
  const rebarPart = rebarKg * SLAB_REBAR_PRICE;

  const cost = betonPart + rebarPart;

  return {
    area,
    betonM3,
    thickness: T,
    cost,
  };
}

function calcStrip(length, width) {
  const L = toNum(length);
  const W = toNum(width);
  if (!(L > 0) || !(W > 0)) bad("Некорректные длина/ширина для ленты.");

  const perimeter = (L + W) * 2; // м.п.
  const betonM3 = perimeter * STRIP_BETON_M3_PER_MP;
  const rebarKg = perimeter * STRIP_REBAR_KG_PER_MP;

  const cost =
    perimeter * STRIP_WORK_PRICE +
    betonM3 * (STRIP_BETON_PRICE + STRIP_TECH_PRICE) +
    rebarKg * STRIP_REBAR_PRICE;

  return {
    perimeter,
    betonM3,
    cost,
  };
}

// -------------------- Основная функция --------------------

function calculateEstimate(input) {
  if (!input || typeof input !== "object") bad("Тело запроса должно быть JSON объектом.");

  const length = toNum(input.length);
  const width = toNum(input.width);
  const height = toNum(input.height);
  const floors = toNum(input.floors);

  if (!(length > 0)) bad("length должен быть > 0.");
  if (!(width > 0)) bad("width должен быть > 0.");
  if (!(height > 0)) bad("height должен быть > 0.");
  if (![1, 2].includes(floors)) bad("floors должен быть 1 или 2.");

  const hasProject = Boolean(input.hasProject);

  const foundation = input.foundation || { type: "none" };
  const foundationType = String(foundation.type || "none"); // slab | strip | none
  const foundationThickness = foundation.thickness;

  const walls = input.walls;
  const roof = input.roof;
  const gates = input.gates || { count: 0 };
  const windows = input.windows || { count: 0 };
  const doors = input.doors; // число (как у тебя сейчас)

  if (!walls || typeof walls !== "object") bad("walls обязателен.");
  if (!roof || typeof roof !== "object") bad("roof обязателен.");

  const wallType = String(walls.type);
  const wallThickness = toNum(walls.thickness);

  if (!["sandwich", "pir"].includes(wallType)) bad("walls.type должен быть sandwich или pir.");
  if (!WALL_PANEL_PRICES[wallType][wallThickness]) bad("Некорректная walls.thickness.");

  const roofType = String(roof.type);
  const roofThickness = toNum(roof.thickness);

  if (!["sandwich", "membrane"].includes(roofType)) bad("roof.type должен быть sandwich или membrane.");
  if (roofType === "sandwich" && !ROOF_PANEL_PRICES.sandwich[roofThickness]) bad("Некорректная roof.thickness.");

  const gatesCount = toNum(gates.count || 0);
  const gatesSize = gates.size ? String(gates.size) : null;
  if (!(gatesCount >= 0)) bad("gates.count должен быть >= 0.");
  if (gatesCount > 0 && !GATE_PRICES[gatesSize]) bad("Некорректный gates.size.");

  const windowsCount = toNum(windows.count || 0);
  const windowsSize = windows.size ? String(windows.size) : null;
  if (!(windowsCount >= 0)) bad("windows.count должен быть >= 0.");
  if (windowsCount > 0 && !WINDOW_PRICES[windowsSize]) bad("Некорректный windows.size.");

  const doorsCount = toNum(doors || 0);
  if (!(doorsCount >= 0)) bad("doors должен быть числом >= 0.");

  const rows = [];
  let baseSubtotal = 0;

  // 01 Проект
  if (!hasProject) {
    rows.push({
      code: "01",
      title: "Проектирование",
      subtitle: "разделы АР, КМ, КМД",
      volume: "3 раздела",
      price: PROJECT_PRICE,
    });
    baseSubtotal += PROJECT_PRICE;
  }

  // 02 Фундамент
  if (foundationType !== "none") {
    if (!["slab", "strip"].includes(foundationType)) bad("foundation.type должен быть slab / strip / none.");

    if (foundationType === "slab") {
      const slab = calcSlab(length, width, foundationThickness);

      // если 2 этажа: плита x2
      const k = floors === 2 ? 2 : 1;

      rows.push({
        code: "02",
        title: "Фундамент",
        subtitle: `монолитная плита толщиной ${String(slab.thickness).replace(".", ",")} м`,
        volume: `${fmt(slab.betonM3 * k, 1)} м3`,
        price: slab.cost * k,
      });
      baseSubtotal += slab.cost * k;
    }

    if (foundationType === "strip") {
      const strip = calcStrip(length, width);

      // если 2 этажа: лента (1 этаж) + плита (2 этаж)
      if (floors === 2) {
        const slab = calcSlab(length, width, foundationThickness);

        const totalFoundationCost = strip.cost + slab.cost;

        rows.push({
          code: "02",
          title: "Фундамент",
          subtitle: `лента + плита (2 этаж), плита ${String(slab.thickness).replace(".", ",")} м`,
          volume: `${fmt(strip.perimeter, 0)} м.п. + ${fmt(slab.betonM3, 1)} м3`,
          price: totalFoundationCost,
        });

        baseSubtotal += totalFoundationCost;
      } else {
        rows.push({
          code: "02",
          title: "Фундамент",
          subtitle: "ленточный (Ш 50 × Гл 80 см)",
          volume: `${fmt(strip.perimeter, 0)} м.п.`,
          price: strip.cost,
        });
        baseSubtotal += strip.cost;
      }
    }
  }

  // 03 Металлоконструкции
  {
    const area = length * width;
    const metalTons = area * (floors === 1 ? METAL_K_TON_PER_M2_1F : METAL_K_TON_PER_M2_2F);
    const metalCost = metalTons * (METAL_PRICE_PER_TON + METAL_WORK_PER_TON);

    rows.push({
      code: "03",
      title: "Металлоконструкции",
      subtitle: `расход ${floors === 1 ? "42" : "70"} кг/м²`,
      volume: `${fmt(metalTons, 2)} т`,
      price: metalCost,
    });
    baseSubtotal += metalCost;
  }

  // 04 Стены
  {
    const wallArea = (length + width) * height * 2; // по таблице
    const panelPrice = WALL_PANEL_PRICES[wallType][wallThickness];
    const wallsCost = wallArea * (WALL_WORK_PRICE + panelPrice) * WALL_COEF;

    rows.push({
      code: "04",
      title: "Стеновые панели",
      subtitle:
        wallType === "sandwich"
          ? `толщина ${wallThickness} мм, сталь 0,45 мм`
          : `ПИР панели, толщина ${wallThickness} мм`,
      volume: `${fmt(wallArea, 0)} м²`,
      price: wallsCost,
    });
    baseSubtotal += wallsCost;
  }

  // 05 Кровля
  {
    const roofArea = length * width * 1.2; // по таблице
    const materialPrice = roofType === "sandwich" ? ROOF_PANEL_PRICES.sandwich[roofThickness] : ROOF_PANEL_PRICES.membrane;

    const roofCost = roofArea * (ROOF_WORK_PRICE + materialPrice);

    rows.push({
      code: "05",
      title: "Кровля",
      subtitle:
        roofType === "sandwich"
          ? `сэндвич-панели ${roofThickness} мм`
          : "наплавляемая",
      volume: `${fmt(roofArea, 0)} м²`,
      price: roofCost,
    });
    baseSubtotal += roofCost;
  }

  // 06 Ворота
  if (gatesCount > 0) {
    const gateCost = GATE_PRICES[gatesSize] * gatesCount;

    rows.push({
      code: "06",
      title: "Ворота",
      subtitle: `размер ${gatesSize.replace("x", "×")} м`,
      volume: `${fmt(gatesCount, 0)} шт`,
      price: gateCost,
    });
    baseSubtotal += gateCost;
  }

  // 07 Окна
  if (windowsCount > 0) {
    const windowCost = WINDOW_PRICES[windowsSize] * windowsCount;

    rows.push({
      code: "07",
      title: "Окна",
      subtitle: `размер ${windowsSize.replace("x", "×")} м`,
      volume: `${fmt(windowsCount, 0)} шт`,
      price: windowCost,
    });
    baseSubtotal += windowCost;
  }

  // 08 Двери
  if (doorsCount > 0) {
    const doorsCost = DOOR_PRICE * doorsCount;

    rows.push({
      code: "08",
      title: "Двери",
      subtitle: "металлические 900×2100 мм",
      volume: `${fmt(doorsCount, 0)} шт`,
      price: doorsCost,
    });
    baseSubtotal += doorsCost;
  }

  // ---------- Наценка 20% ко всем строкам и итогу ----------
  const totalCash = Math.round(baseSubtotal * TOTAL_COEF);

  // умножаем каждую строку, округляем, и выравниваем разницу на последней строке
  const scaledRows = rows.map((r) => ({
    ...r,
    price: Math.round(r.price * TOTAL_COEF),
  }));

  const sumScaled = scaledRows.reduce((acc, r) => acc + r.price, 0);
  const diff = totalCash - sumScaled;
  if (diff !== 0 && scaledRows.length > 0) {
    scaledRows[scaledRows.length - 1].price += diff;
  }

  return {
    rows: scaledRows,
    totalCash,
  };
}

module.exports = { calculateEstimate };
