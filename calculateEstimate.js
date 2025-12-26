// calculateEstimate.js

const WALL_WORK_PRICE = 1300;
const WALL_COEF = 1.3;

const WALL_PANEL_PRICES = {
  sandwich: { 100: 2855, 120: 3055, 150: 3355 },
  pir: { 60: 2750, 100: 3350, 150: 4300 }
};

const ROOF_WORK_PRICE = 1100;
const ROOF_COEF = 1.2;

const ROOF_PANEL_PRICES = {
  sandwich: { 100: 3000, 150: 3600, 200: 4200 },
  membrane: 2500
};

const PROJECT_PRICE = 300000;
const DOOR_PRICE = 80000;

const IP_COEF = 1.07;
const OOO_COEF = 1.2;

const round = v => Math.round(v);

function calculateEstimate(input) {
  const { length, width, height, hasProject, walls, roof, gates, windows, doors } = input;

  const rows = [];
  let subtotal = 0;

  if (!hasProject) {
    rows.push({
      code: "01",
      title: "Проектирование",
      subtitle: "Разделы АР, КМ, КМД",
      volume: "3 раздела",
      price: PROJECT_PRICE
    });
    subtotal += PROJECT_PRICE;
  }

  const perimeter = (length + width) * 2;
  const wallArea = perimeter * height;
  const roofArea = length * width;

  const wallPanelPrice = WALL_PANEL_PRICES[walls.type][walls.thickness];
  const wallsCost = round(wallArea * (WALL_WORK_PRICE + wallPanelPrice) * WALL_COEF);

  rows.push({
    code: "02",
    title: "Стеновые панели",
    subtitle: `${walls.type === "sandwich" ? "Сэндвич" : "ПИР"} ${walls.thickness} мм`,
    volume: `${round(wallArea)} м²`,
    price: wallsCost
  });
  subtotal += wallsCost;

  const roofMaterialPrice =
    roof.type === "sandwich"
      ? ROOF_PANEL_PRICES.sandwich[roof.thickness]
      : ROOF_PANEL_PRICES.membrane;

  const roofCost = round(roofArea * (ROOF_WORK_PRICE + roofMaterialPrice) * ROOF_COEF);

  rows.push({
    code: "03",
    title: "Кровля",
    subtitle:
      roof.type === "sandwich"
        ? `Сэндвич-панели ${roof.thickness} мм`
        : "Мембранная",
    volume: `${round(roofArea)} м²`,
    price: roofCost
  });
  subtotal += roofCost;

  if (gates.count > 0) {
    const GATE_PRICES = { "3x3": 250000, "3x4": 320000, "3x5": 380000 };
    const gateCost = GATE_PRICES[gates.size] * gates.count;

    rows.push({
      code: "04",
      title: "Ворота",
      subtitle: `Подъёмные ${gates.size} м`,
      volume: `${gates.count} шт`,
      price: gateCost
    });
    subtotal += gateCost;
  }

  if (windows.count > 0) {
    const WINDOW_PRICES = { "1.2x2": 45000, "1.2x3": 65000, "1.2x5": 90000 };
    const windowCost = WINDOW_PRICES[windows.size] * windows.count;

    rows.push({
      code: "05",
      title: "Окна",
      subtitle: `Металлопластиковые ${windows.size} м`,
      volume: `${windows.count} шт`,
      price: windowCost
    });
    subtotal += windowCost;
  }

  if (doors > 0) {
    const doorsCost = doors * DOOR_PRICE;

    rows.push({
      code: "06",
      title: "Двери",
      subtitle: "Входные металлические 900×2100 мм",
      volume: `${doors} шт`,
      price: doorsCost
    });
    subtotal += doorsCost;
  }

  return {
    rows,
    subtotal: round(subtotal),
    totalCash: round(subtotal),
    totalIP: round(subtotal * IP_COEF),
    totalOOO: round(subtotal * OOO_COEF)
  };
}

module.exports = { calculateEstimate };
