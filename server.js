const express = require("express");
const { chromium } = require("playwright");
const { calculateEstimate } = require("./calculateEstimate");

const app = express();
app.use(express.json({ limit: "1mb" }));

function buildHtml(input, estimate) {
  const date = new Date().toLocaleDateString("ru-RU");

  const rowsHtml = estimate.rows.map(row => `
    <tr>
      <td class="num">${row.code}</td>
      <td class="name">
        ${row.title}
        ${row.subtitle ? `<div class="sub">${row.subtitle}</div>` : ``}
      </td>
      <td class="vol">${row.volume}</td>
      <td class="price">${row.price.toLocaleString("ru-RU")} ₽</td>
    </tr>
  `).join("");

  return `
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">

<style>
@page {
  size: A4;
  margin: 0mm;
}

/* ---------- FONTS ---------- */
@font-face {
  font-family: "Gilroy";
  src: url("fonts/Gilroy-Regular.woff2") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "Gilroy";
  src: url("fonts/Gilroy-Medium.woff2") format("woff2");
  font-weight: 500;
}
@font-face {
  font-family: "Gilroy";
  src: url("fonts/Gilroy-Bold.woff2") format("woff2");
  font-weight: 700;
}

body {
  font-family: "Gilroy", sans-serif;
  color: #111;
  margin: 0;
}

.container {
  max-width:  668px;
  margin: 0 auto;
  margin-top: 50px;
}

/* ---------- HEADER ---------- */
.header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #8c8c8c;
  margin-bottom: 48px;
}

.header .offer {
    color: #000;
}

.header .bigger {
    font-size: 13px;
}

/* ---------- TITLE ---------- */
.title h1 {
  font-size: 22px;
  margin-bottom:  0;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: 700;
}

.title h2 {
  font-size: 22px;
  font-weight: 400;
  font-style: italic;
  margin: 0;
}

/* ---------- TABLE ---------- */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 48px;
}

thead th {
  font-size: 11px;
  color: #9a9a9a;
  font-weight: 400;
  padding-bottom: 14px;
  border-bottom: 1px solid #eaeaea;
  text-align: left;
}

.black {
  color: #000;
  font-weight: 500;
}

tbody td {
  padding: 24px 0;
  border-bottom: 1px solid #eaeaea;
  vertical-align: top;
  font-size: 14px;
}

.num {
  width: 40px;
  color: #9a9a9a;
}

.name {
  width: auto;
}

.sub {
  font-size: 11px;
  color: #9a9a9a;
  margin-top: 4px;
}

.vol {
  width: 110px;
  text-align: right;
  color: #000;
}

.price {
  width: 160px;
  text-align: right;
  font-weight: 500;
  color: #000;
}

/* ---------- TOTAL ---------- */
.total {
  margin-top: 48px;
  font-size: 30px;
  font-weight: 700;
  text-align: right;
}

/* ---------- INFO ---------- */
.info {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  font-size: 12px;
}

/* ---------- FIXED FULL WIDTH FOOTER ---------- */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;

  height: 12mm;

  background: #111;
  color: #fff;

  padding: 5mm 12mm;

  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer .brand {
  font-size: 22px;
  font-weight: 700;
}

.italic {
  font-weight: 400;
  font-style: italic;
}

.footer .contacts {
  font-size: 12px;
  text-align: right;
}
</style>
</head>

<body>

<div class="container">
  <div class="header">
    <div class="offer">
      Предварительное предложение от ${date}<br>
      действует 14 дней
    </div>
    <div class="bigger">БОЛЬШЕ, ЧЕМ ПРОСТО СТРОЙКА</div>
  </div>
  
  <div class="title">
    <h1>СТРОИТЕЛЬСТВО<br>ЗДАНИЯ ПОД КЛЮЧ</h1>
    <h2>${input.length} × ${input.width} × ${input.height} м, ${input.floors} этаж</h2>
  </div>
  
  <table>
  <thead>
  <tr>
    <th></th>
    <th class="black">Наименование работ</th>
    <th class="vol">Объем</th>
    <th class="price">Стоимость</th>
  </tr>
  </thead>
  <tbody>
  ${rowsHtml}
  </tbody>
  </table>
  
  <div class="total">
    ${estimate.totalCash.toLocaleString("ru-RU")} ₽
  </div>
  
  <div class="info">
    <div>
      <strong>Оплата</strong><br>
      По этапам работ<br>
      Наличный расчет / ИП +7% / ООО +20%
    </div>
    <div>
      <strong>Сроки</strong><br>
      Реализация: 3–6 мес<br>
      Гарантия: 2 года
    </div>
  </div>
</div>

<div class="footer">
  <div class="brand">BIG <span class="italic">SPACES</span></div>
  <div class="contacts">
    +7 911 002 90 07<br>
    WhatsApp · Telegram
  </div>
</div>

</body>
</html>`;
}

app.post("/calculate", (req, res) => {
  try {
    const estimate = calculateEstimate(req.body);

    res.json({
      success: true,
      total: estimate.totalCash
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

app.post("/pdf", async (req, res) => {
  try {
    const estimate = calculateEstimate(req.body);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.setContent(buildHtml(req.body, estimate), {
      waitUntil: "networkidle"
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="estimate.pdf"');
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => {
  console.log("PDF server running on http://localhost:3000");
});
