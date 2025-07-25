import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import fs from "fs/promises";
import path from "path";

// Импортируем учетные данные
// Используем require, так как это JSON-файл и опция resolveJsonModule включена
const creds = require("../google-credentials.json");

// ID вашей таблицы (из URL: .../spreadsheets/d/THIS_IS_THE_ID/edit)
const SPREADSHEET_ID = "1OgDjenqcyfThw90ZyI2jjxxzm_V6oGBBOk37tb9omtA";

// Настройка JWT-клиента для аутентификации
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"], // <-- Исправлено
});

// Инициализируем документ
const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

// Определяем, какие листы и как мы хотим обработать
const sheetsToProcess = {
  Месяцы: "months.json",
  "Дверь года": "yearDoor.json",
  Риск: "risk.json",
  События: "events.json",
};

async function fetchData() {
  try {
    console.log("Loading document info...");
    await doc.loadInfo();
    console.log(`Document loaded: "${doc.title}"`);

    const outputDir = path.join(__dirname, "..", "src", "data", "taroscop");
    await fs.mkdir(outputDir, { recursive: true });

    // Проходим по каждому листу, который нужно обработать
    for (const sheetTitle in sheetsToProcess) {
      console.log(`Processing sheet: "${sheetTitle}"...`);

      const sheet = doc.sheetsByTitle[sheetTitle];
      if (!sheet) {
        console.warn(`Sheet "${sheetTitle}" not found, skipping.`);
        continue;
      }

      // Загружаем ячейки. Это более надежный способ, чем getRows, если у вас нет заголовков
      // Мы загружаем только первые две колонки (A и B)
      await sheet.loadCells("A1:B" + sheet.rowCount);

      const data: { [key: string]: string } = {};

      // Проходим по каждой строке, чтобы получить ключ и значение
      for (let i = 0; i < sheet.rowCount; i++) {
        const keyCell = sheet.getCell(i, 0); // Ячейка в колонке A
        const valueCell = sheet.getCell(i, 1); // Ячейка в колонке B

        const key = keyCell.value ? String(keyCell.value) : null;
        const value = valueCell.value ? String(valueCell.value) : null;

        if (key && value) {
          data[key] = value;
        }
      }

      const outputFileName =
        sheetsToProcess[sheetTitle as keyof typeof sheetsToProcess];
      const outputFilePath = path.join(outputDir, outputFileName);

      await fs.writeFile(outputFilePath, JSON.stringify(data, null, 2));
      console.log(`Successfully created ${outputFilePath}`);
    }

    console.log("\nAll data fetched and saved successfully!");
  } catch (error) {
    console.error("Error fetching data from Google Sheets:", error);
  }
}

fetchData();
