import PDFDocument from "pdfkit";
import { Writable } from "stream";

// Определим тип для данных, которые будем получать
interface ForecastData {
  yearDoor: { arcanum: number; text: string };
  events: { arcanum: number; text: string };
  monthlyForecasts: Array<{
    monthName: string;
    exam: { arcanum: number; text: string };
    risk: { arcanum: number; text: string };
  }>;
}

export function generateForecastPdf(
  data: ForecastData,
  stream: Writable,
  birthDate: string
): void {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  // Связываем документ с потоком (например, HTTP-ответом)
  doc.pipe(stream);

  // --- Стили и шрифты ---
  // (pdfkit не поддерживает кириллицу по умолчанию, нужно встроить шрифт)
  // Скачайте шрифт, поддерживающий кириллицу (например, DejaVuSans.ttf),
  // и положите его в папку, например, `src/assets/fonts`
  // Путь к шрифту:
  const fontPath = "./src/assets/fonts/DejaVuSans.ttf";
  const fontBoldPath = "./src/assets/fonts/DejaVuSans-Bold.ttf";

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  // --- Заголовок документа ---
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Ваш нумерологический прогноз", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  // --- Годовые показатели ---
  doc.font("DejaVu-Bold").fontSize(18).text("Главные темы года");
  doc.moveDown();

  // Дверь года
  doc.font("DejaVu-Bold").fontSize(14).text("ДВЕРЬ ГОДА: Ваш главный шанс");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.yearDoor.text, { align: "justify" });
  doc.moveDown(2);

  // События
  doc.font("DejaVu-Bold").fontSize(14).text("СОБЫТИЙНЫЙ УДАР: Чего избегать");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.events.text, { align: "justify" });
  doc.moveDown(3);

  // --- Ежемесячные прогнозы ---
  doc.font("DejaVu-Bold").fontSize(18).text("Прогноз по месяцам");
  doc.moveDown();

  data.monthlyForecasts.forEach((monthData) => {
    // Проверяем, хватит ли места на странице для следующего блока, иначе переносим на новую
    // (очень приблизительная проверка, но для начала сойдет)
    if (doc.y > 650) {
      doc.addPage();
    }

    doc
      .font("DejaVu-Bold")
      .fontSize(16)
      .text(monthData.monthName, { underline: true });
    doc.moveDown();

    // Экзамен месяца
    doc.font("DejaVu-Bold").fontSize(12).text("ЭКЗАМЕН МЕСЯЦА");
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(monthData.exam.text, { align: "justify" });
    doc.moveDown();

    // Риск месяца
    doc.font("DejaVu-Bold").fontSize(12).text("РИСК МЕСЯЦА");
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(monthData.risk.text, { align: "justify" });
    doc.moveDown(2);
  });

  // Завершаем документ
  doc.end();
}
