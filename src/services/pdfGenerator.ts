import PDFDocument from "pdfkit";
import { Writable } from "stream";
import { IContent } from "../models/content.model";

interface ForecastData {
  yearDoor: { arcanum: number; text: string };
  events: { arcanum: number; text: string };
  monthlyForecasts: Array<{
    monthName: string;
    exam: { arcanum: number; text: string };
    risk: { arcanum: number; text: string };
  }>;
}

interface PdfData {
  forecast: ForecastData;
  saleScript: IContent | null;
}

export function generateForecastPdf(
  data: PdfData,
  stream: Writable,
  birthDate: string
): void {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  const fontPath = "./src/assets/fonts/DejaVuSans.ttf";
  const fontBoldPath = "./src/assets/fonts/DejaVuSans-Bold.ttf";

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth = 200;
    const imageHeight = 150;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/photo_2025-07-25_20-34-07.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 20;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }
  
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Ваш Тароскоп", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("Главные темы года");
  doc.moveDown();

  doc.font("DejaVu-Bold").fontSize(14).text("ДВЕРЬ ГОДА: Ваш главный шанс");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.forecast.yearDoor.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(14).text("СОБЫТИЙНЫЙ УДАР: Чего избегать");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.forecast.events.text, { align: "justify" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("Прогноз по месяцам");
  doc.moveDown();

  data.forecast.monthlyForecasts.forEach((monthData) => {
    if (doc.y > 650) {
      doc.addPage();
    }

    doc
      .font("DejaVu-Bold")
      .fontSize(16)
      .text(monthData.monthName, { underline: true });
    doc.moveDown();

    doc.font("DejaVu-Bold").fontSize(12).text("ЭКЗАМЕН МЕСЯЦА");
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(monthData.exam.text, { align: "justify" });
    doc.moveDown();

    doc.font("DejaVu-Bold").fontSize(12).text("РИСК МЕСЯЦА");
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(monthData.risk.text, { align: "justify" });
    doc.moveDown(2);
  });

  if (data.saleScript) {
    doc.addPage();
    doc
      .font("DejaVu-Bold")
      .fontSize(20)
      .text(data.saleScript.title, { align: "center" });
    doc.moveDown(2);

    doc
      .font("DejaVu-Regular")
      .fontSize(14)
      .text(data.saleScript.description, { align: "center" });
    doc.moveDown(2);
    
    doc
      .font("DejaVu-Regular")
      .fontSize(11)
      .text(data.saleScript.content, { align: "left" });
  }

  doc.end();
}

interface FinancialCastData {
  moneyKnot: { arcanum: number; text: string };
  archetypePoverty: { arcanum: number; text: string };
  duty: { arcanum: number; text: string };
  shadowWealth: { arcanum: number; text: string };
  rituals: Array<{ title: string; text: string }>;
}

interface FinancialCastPdfData {
  financialCast: FinancialCastData;
  saleScript: IContent | null;
}

export function generateFinancialCastPdf(
  data: FinancialCastPdfData,
  stream: Writable,
  birthDate: string
): void {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  const fontPath = "./src/assets/fonts/DejaVuSans.ttf";
  const fontBoldPath = "./src/assets/fonts/DejaVuSans-Bold.ttf";

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth = 180;
    const imageHeight = 230;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/financialCast.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }
  
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Расчет 4 кода денег", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Денежный узел");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.financialCast.moneyKnot.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Архетип бедности");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.financialCast.archetypePoverty.text, { align: "justify" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Долг");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.financialCast.duty.text, { align: "justify" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Тень богатства");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.financialCast.shadowWealth.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Ритуалы");
  doc.moveDown(1);
  data.financialCast.rituals.forEach((ritual) => {
    doc.font("DejaVu-Bold").fontSize(13).text(ritual.title);
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(ritual.text, { align: "justify" });
    doc.moveDown();
  });

  doc.moveDown(3);

  if (data.saleScript) {
    doc.addPage();
    doc
      .font("DejaVu-Bold")
      .fontSize(20)
      .text(data.saleScript.title, { align: "center" });
    doc.moveDown(2);

    doc
      .font("DejaVu-Regular")
      .fontSize(14)
      .text(data.saleScript.description, { align: "center" });
    doc.moveDown(2);
    
    doc
      .font("DejaVu-Regular")
      .fontSize(11)
      .text(data.saleScript.content, { align: "left" });
  }

  doc.end();
}
