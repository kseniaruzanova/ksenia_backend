import PDFDocument from "pdfkit";
import { Writable } from "stream";
import { AwakeningCodesData, FinancialCastData, ForecastData, KarmicTailData, MatrixLifeData, MistakesIncarnationData, MonthlyForecast, RitualItem } from "../interfaces/arcan";

const fontPath: string = "./src/assets/fonts/DejaVuSans.ttf";
const fontBoldPath: string = "./src/assets/fonts/DejaVuSans-Bold.ttf";

export function generateForecastPdf(
  data: ForecastData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 200;
    const imageHeight: number = 150;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/images/forecast.jpg', x, doc.y, {
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
    .text(data.yearDoor.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(14).text("СОБЫТИЙНЫЙ УДАР: Чего избегать");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.events.text, { align: "justify" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("Прогноз по месяцам");
  doc.moveDown();

  data.monthlyForecasts.forEach((monthData: MonthlyForecast) => {
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

  doc.end();
}

export function generateFinancialCastPdf(
  data: FinancialCastData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 180;
    const imageHeight: number = 230;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/images/financialCast.jpg', x, doc.y, {
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
    .text(data.moneyKnot.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Архетип бедности");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.archetypePoverty.text, { align: "justify" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Долг");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.duty.text, { align: "justify" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Тень богатства");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.shadowWealth.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Ритуалы");
  doc.moveDown(1);
  data.ritualsMap.forEach((ritual: RitualItem) => {
    try {
      const imageWidth: number = 200;
      const imageHeight: number = 150;
      const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
      
      doc.image('./src/assets/images/rituals.jpg', x, doc.y, {
        fit: [imageWidth, imageHeight]
      });
      
      doc.y = doc.y + 100 + 10;
    } catch (error) {
      console.log('Изображение ритуала не найдено:', error);
    }
    doc.font("DejaVu-Bold").fontSize(13).text(ritual.title);
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(ritual.text, { align: "justify" });
    doc.moveDown();
  });

  doc.moveDown(3);

  doc.end();
}

export function generateMistakesIncarnationPdf(
  data: MistakesIncarnationData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 180;
    const imageHeight: number = 230;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/images/mistakesIncarnation.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }
  
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Расчет «Ошибки прошлого воплощения»", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Ваш урок на это воплощение. Этот расчет не меняется в течение жизни! Это ваше ядро личности!");
  doc.moveDown(1);
  doc.font("DejaVu-Bold").fontSize(14).text("Ваш урок на это воплощение:");
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.lessonIncarnation.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Кармические уроки, кармические ошибки и кармические черты характера (это нельзя повторять в этой жизни):");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.karmicLessons.text, { align: "justify" });
  doc.moveDown(2);

  doc.end();
}

export function generateAwakeningCodesPdf(
  data: AwakeningCodesData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 180;
    const imageHeight: number = 230;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/images/awakeningCodes.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }
  
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Расчет «Три кода пробуждения: твоя суть, твой страх и твоя реализация»", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Трактовка 1: Ядро");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.core.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Трактовка 2: Страх");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.fear.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Трактовка 3: Реализация");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.implementation.text, { align: "justify" });
  doc.moveDown(2);

  doc.end();
}

export function generateMatrixLifePdf(
  data: MatrixLifeData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 180;
    const imageHeight: number = 230;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;

    doc.image('./src/assets/images/matrixLife.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });

    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }

  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Расчет «Матрица Жизни и коды жизни»", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  // Вывод матрицы из data.matrix
  if (data.matrix && Array.isArray(data.matrix)) {
    doc.font("DejaVu-Bold").fontSize(16).text("Матрица:", { align: "left" });
    doc.moveDown(1);

    const colWidth = 80;
    const rowHeight = 40;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableWidth = colWidth * 5;
    const startX = doc.page.margins.left + (pageWidth - tableWidth) / 2;
    const startY = doc.y;

    doc.font("DejaVu-Regular").fontSize(14);

    // Отрисовка строк матрицы
    for (let i = 0; i < data.matrix.length; i++) {
      const row = data.matrix[i];
      const currentY = startY + i * rowHeight;
      
      for (let j = 0; j < row.length; j++) {
        const cellX = startX + j * colWidth;
        
        // Рисуем границы ячейки
        doc.rect(cellX, currentY, colWidth, rowHeight).stroke();
        
        // Рисуем текст в центре ячейки
        doc.text(String(row[j]), cellX, currentY + (rowHeight / 2) - 7, { 
          width: colWidth, 
          align: "center",
          lineBreak: false
        });
      }
    }
    
    // Обновляем позицию Y после таблицы
    doc.y = startY + data.matrix.length * rowHeight;

    doc.moveDown(1);
  }

  // Вывод кодов
  if (data.codes) {
    // Сбрасываем позицию X на начальный отступ
    doc.x = doc.page.margins.left;
    doc.moveDown(2);
    
    // Добавляем текст-переход
    doc.font("DejaVu-Regular").fontSize(13).text(
      "В вашей матрице обнаружены следующие коды жизни, которые указывают на особые характеристики и жизненные тенденции:",
      { align: "center" }
    );
    
    doc.addPage();
    
    doc.font("DejaVu-Bold").fontSize(18).text("Коды жизни:", { align: "center" });
    doc.moveDown(2);

    const renderCodeSection = (title: string, codes: string[]) => {
      // Проверяем, нужно ли добавить новую страницу
      if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
        doc.addPage();
      }

      doc.font("DejaVu-Bold").fontSize(14).text(title, { align: "left" });
      doc.moveDown(0.5);
      
      if (codes.length > 0) {
        doc.font("DejaVu-Regular").fontSize(12).text(codes.join("; "), { 
          align: "left",
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right
        });
      } else {
        doc.font("DejaVu-Regular").fontSize(12).fillColor("#999999").text("Не обнаружено", { align: "left" });
        doc.fillColor("#000000");
      }
      doc.moveDown(1.5);
    };

    renderCodeSection("Коды богатства:", data.codes.richCodes);
    renderCodeSection("Коды брака:", data.codes.marriageCodes);
    renderCodeSection("Коды выгодного брака:", data.codes.profitableMarriageCodes);
    renderCodeSection("Коды проблем с детьми:", data.codes.childIssueCodes);
    renderCodeSection("Коды онкологии:", data.codes.oncologyCodes);
    renderCodeSection("Коды аварий/травм:", data.codes.accidentCodes);
    renderCodeSection("Коды иностранного брака:", data.codes.foreignMarriageCodes);
    renderCodeSection("Коды нестабильности:", data.codes.instabilityCodes);
    renderCodeSection("Коды психологических проблем:", data.codes.psychProblemsCodes);
    renderCodeSection("Коды одиночества:", data.codes.lonelinessCodes);
  }

  doc.end();
}

export function generateKarmicTailPdf(
  data: KarmicTailData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 180;
    const imageHeight: number = 230;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/images/karmicTail.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }
  
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Расчет «Кармический хвост, предназначение и карма денег»", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(16).text("Личное предназначение:");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.personalPurpose.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.font("DejaVu-Bold").fontSize(16).text("Социальное предназначение");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.socialPurpose.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.font("DejaVu-Bold").fontSize(16).text("Духовное предназначение");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.spiritualPurpose.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.font("DejaVu-Bold").fontSize(16).text("Планетарное предназначение");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.planetaryPurpose.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.font("DejaVu-Bold").fontSize(16).text("Кармический хвост");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.kamaciTail.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.font("DejaVu-Bold").fontSize(16).text("Главный кармический урок души");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.lessonSoul.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.font("DejaVu-Bold").fontSize(16).text("Материальная карма прошлого");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.karmaPast.text, { align: "justify" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text("Центр финансов");
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.financeCenter.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.end();
}
