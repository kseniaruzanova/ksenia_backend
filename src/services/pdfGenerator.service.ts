import PDFDocument from "pdfkit";
import { Writable } from "stream";
import { ArchetypeMonthData, ArchetypeShadowData, AwakeningCodesData, FinancialCastData, ForecastData, KarmicTailData, LifeMatrixData, MatrixLifeData, MistakesIncarnationData, MonthlyForecast, RitualItem, StagnationCycleData } from "../interfaces/arcan";
import tractovkiDataJSON from "../data/matrixLife/tractovki.json";

const fontPath: string = "./src/assets/fonts/DejaVuSans.ttf";
const fontBoldPath: string = "./src/assets/fonts/DejaVuSans-Bold.ttf";

const tractovkiData = tractovkiDataJSON as Record<string, CodeInterpretation[]>;

interface CodeInterpretation {
  code: string;
  activation: string;
  neutralization: string;
}

// Функция для поиска трактовки кода
function findCodeInterpretation(code: string, category: string): CodeInterpretation | null {
  const categoryData = tractovkiData[category];
  if (!categoryData || !Array.isArray(categoryData)) {
    return null;
  }
  
  const interpretation = categoryData.find((item: CodeInterpretation) => item.code === code);
  return interpretation || null;
}

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
    doc.moveDown();

    doc.font("DejaVu-Bold").fontSize(12).text("СОБЫТИЙНЫЙ УДАР: Чего избегать");
    doc
      .font("DejaVu-Regular")
      .fontSize(10)
      .text(data.events.text, { align: "justify" });
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

    const renderCodeSection = (title: string, codes: string[], category: string) => {
      // Проверяем, нужно ли добавить новую страницу
      if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
        doc.addPage();
      }

      doc.font("DejaVu-Bold").fontSize(14).text(title, { align: "left" });
      doc.moveDown(0.5);
      
      if (codes.length > 0) {
        codes.forEach((code, index) => {
          // Проверяем место на странице перед выводом каждого кода
          if (doc.y > doc.page.height - doc.page.margins.bottom - 150) {
            doc.addPage();
          }

          // Выводим код жирным шрифтом
          doc.font("DejaVu-Bold").fontSize(12).fillColor("#1a5490").text(`Код ${code}:`, { 
            align: "left",
            continued: false
          });
          doc.fillColor("#000000");
          doc.moveDown(0.3);
          
          // Ищем трактовку для этого кода
          const interpretation = findCodeInterpretation(code, category);
          
          if (interpretation) {
            // Выводим активацию
            doc.font("DejaVu-Bold").fontSize(11).text("Активация:", { align: "left" });
            doc.font("DejaVu-Regular").fontSize(11).text(interpretation.activation, { 
              align: "left",
              width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            });
            doc.moveDown(0.5);
            
            // Выводим нейтрализацию
            doc.font("DejaVu-Bold").fontSize(11).text("Нейтрализация:", { align: "left" });
            doc.font("DejaVu-Regular").fontSize(11).text(interpretation.neutralization, { 
              align: "left",
              width: doc.page.width - doc.page.margins.left - doc.page.margins.right
            });
          } else {
            doc.font("DejaVu-Regular").fontSize(11).fillColor("#999999").text("Трактовка не найдена", { align: "left" });
            doc.fillColor("#000000");
          }
          
          if (index < codes.length - 1) {
            doc.moveDown(1);
          }
        });
      } else {
        doc.font("DejaVu-Regular").fontSize(12).fillColor("#999999").text("Не обнаружено", { align: "left" });
        doc.fillColor("#000000");
      }
      doc.moveDown(1.5);
    };

    renderCodeSection("Коды богатства:", data.codes.richCodes, "КОДЫ БОГАТСТВА");
    renderCodeSection("Коды брака:", data.codes.marriageCodes, "КОДЫ УДАЧНОГО БРАКА");
    renderCodeSection("Коды выгодного брака:", data.codes.profitableMarriageCodes, "КОДЫ ВЫГОДНОГО БРАКА");
    renderCodeSection("Коды проблем с детьми:", data.codes.childIssueCodes, "КОДЫ ПРОБЛЕМ С ДЕТЬМИ");
    renderCodeSection("Коды онкологии:", data.codes.oncologyCodes, "КОДЫ ОНКОЛОГИИ");
    renderCodeSection("Коды аварий/травм:", data.codes.accidentCodes, "КОДЫ НЕСЧАСТНЫХ СЛУЧАЕВ");
    renderCodeSection("Коды иностранного брака:", data.codes.foreignMarriageCodes, "КОДЫ БРАКА С ИНОСТРАНЦЕМ");
    renderCodeSection("Коды нестабильности:", data.codes.instabilityCodes, "КОДЫ НЕСТАБИЛЬНОСТИ");
    renderCodeSection("Коды психологических проблем:", data.codes.psychProblemsCodes, "КОДЫ ПСИХОЛОГИЧЕСКИХ ПРОБЛЕМ");
    renderCodeSection("Коды одиночества:", data.codes.lonelinessCodes, "КОДЫ ОДИНОЧЕСТВА");
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

export function generateArchetypeShadowPdf(
  data: ArchetypeShadowData,
  stream: Writable,
  birthDate: string
): void {
  const doc: PDFKit.PDFDocument = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 72, right: 72 },
    bufferPages: true,
  });

  console.log(data);
  
  doc.pipe(stream);

  doc.registerFont("DejaVu-Regular", fontPath);
  doc.registerFont("DejaVu-Bold", fontBoldPath);

  try {
    const imageWidth: number = 180;
    const imageHeight: number = 230;
    const pageWidth: number = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x: number = doc.page.margins.left + (pageWidth - imageWidth) / 2;
    
    doc.image('./src/assets/images/archetypeShadow.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }
  
  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Архетип и тень", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(2);

  // Базовый архетип
  if (doc.y > 650) {
    doc.addPage();
  }
  doc.font("DejaVu-Bold").fontSize(16).fillColor("#1a5490").text("БАЗОВЫЙ АРХЕТИП");
  doc.fillColor("#000000");
  doc.moveDown(1);
  doc.font("DejaVu-Regular").fontSize(11).text(data.first.text, { align: "justify" });
  doc.moveDown(2);

  // Теневой архетип
  if (doc.y > 600) {
    doc.addPage();
  }
  doc.font("DejaVu-Bold").fontSize(16).fillColor("#8b0000").text("ТЕНЕВОЙ АРХЕТИП");
  doc.fillColor("#000000");
  doc.moveDown(1);
  doc.font("DejaVu-Regular").fontSize(11).text(data.second.text, { align: "justify" });
  doc.moveDown(2);

  // Ограничивающий архетип
  if (doc.y > 600) {
    doc.addPage();
  }
  doc.font("DejaVu-Bold").fontSize(16).fillColor("#8b4513").text("ОГРАНИЧИВАЮЩИЙ АРХЕТИП");
  doc.fillColor("#000000");
  doc.moveDown(1);
  doc.font("DejaVu-Regular").fontSize(11).text(data.third.text, { align: "justify" });
  doc.moveDown(2);

  // Архетип трансформации
  if (doc.y > 600) {
    doc.addPage();
  }
  doc.font("DejaVu-Bold").fontSize(16).fillColor("#4b0082").text("АРХЕТИП ТРАНСФОРМАЦИИ");
  doc.fillColor("#000000");
  doc.moveDown(1);
  doc.font("DejaVu-Regular").fontSize(11).text(data.fourth.text, { align: "justify" });
  doc.moveDown(2);
  
  doc.end();
}

export function generateArchetypeMonthPdf(
  data: ArchetypeMonthData,
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
    .text("Архетип месяца", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`Расчет для даты: ${birthDate}`, { align: "center" });
  doc.moveDown(2);

  doc.font("DejaVu-Bold").fontSize(16).text(`Ваш аркан: ${data.archetype.arcanum}`);
  doc.moveDown(1);
  doc
    .font("DejaVu-Regular")
    .fontSize(12)
    .text(data.archetype.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });

  doc.end();
}

export function generateLifeMatrixPdf(
  data: LifeMatrixData,
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
    
    doc.image('./src/assets/images/matrixLifeNew.jpg', x, doc.y, {
      fit: [imageWidth, imageHeight]
    });
    
    doc.y = doc.y + imageHeight + 5;
  } catch (error) {
    console.log('Изображение не найдено:', error);
  }

  doc
    .font("DejaVu-Bold")
    .fontSize(24)
    .text("Расчет «Матрица жизни»", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`по дате рождения: ${birthDate}`, { align: "center" });
  doc.moveDown(3);

  // Вывод матрицы
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

    doc.moveDown(2);
  }

  doc.x = doc.page.margins.left;

  // Аркан дня рождения
  doc.font("DejaVu-Bold").fontSize(16).text("Аркан вашего дня рождения:", { align: "left" });
  doc.moveDown(0.5);
  doc.font("DejaVu-Bold").fontSize(14).fillColor("#4b0082").text(`Аркан ${data.birthDayArcanum.arcanum}`, { align: "left" });
  doc.fillColor("#000000");
  doc.moveDown(0.5);
  doc.font("DejaVu-Regular").fontSize(11).text(data.birthDayArcanum.text, { align: "justify" });
  doc.moveDown(2);

  // Аркан года
  doc.font("DejaVu-Bold").fontSize(16).text("Аркан года:", { align: "left" });
  doc.moveDown(0.5);
  doc.font("DejaVu-Bold").fontSize(14).fillColor("#4b0082").text(`Аркан ${data.yearArcanum.arcanum}`, { align: "left" });
  doc.fillColor("#000000");
  doc.moveDown(0.5);
  doc.font("DejaVu-Regular").fontSize(11).text(data.yearArcanum.text, { align: "justify" });
  doc.moveDown(2);

  // Аркан задачи высших сил
  doc.font("DejaVu-Bold").fontSize(16).text("Аркан задачи высших сил:", { align: "left" });
  doc.moveDown(0.5);
  doc.font("DejaVu-Bold").fontSize(14).fillColor("#4b0082").text(`Аркан ${data.higherForcesTaskArcanum.arcanum}`, { align: "left" });
  doc.fillColor("#000000");
  doc.moveDown(0.5);
  doc.font("DejaVu-Regular").fontSize(11).text(data.higherForcesTaskArcanum.text, { align: "justify" });
  doc.moveDown(2);

  // Урок на это воплощение
  doc.font("DejaVu-Bold").fontSize(16).text("Ваш урок на это воплощение:", { align: "left" });
  doc.moveDown(0.5);
  doc.font("DejaVu-Bold").fontSize(14).fillColor("#4b0082").text(`Аркан ${data.incarnationLesson.arcanum}`, { align: "left" });
  doc.fillColor("#000000");
  doc.moveDown(0.5);
  doc.font("DejaVu-Regular").fontSize(11).text(data.incarnationLesson.text, { align: "justify" });
  doc.moveDown(2);

  // Аркан самореализации
  doc.font("DejaVu-Bold").fontSize(16).text("Аркан вашей самореализации:", { align: "left" });
  doc.moveDown(0.5);
  doc.font("DejaVu-Bold").fontSize(14).fillColor("#4b0082").text(`Аркан ${data.selfRealizationArcanum.arcanum}`, { align: "left" });
  doc.fillColor("#000000");
  doc.moveDown(0.5);
  doc.font("DejaVu-Regular").fontSize(11).text(data.selfRealizationArcanum.text, { align: "justify" });
  doc.moveDown(3);

  // Периоды жизни - таблица
  doc.font("DejaVu-Bold").fontSize(16).text("Ваши периоды жизни:", { align: "left" });
  doc.moveDown(1);

  // Создаем таблицу периодов
  const periodColWidth = 100;
  const periodRowHeight = 30;
  const periodTableWidth = periodColWidth * 2;
  const periodPageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const periodStartX = doc.page.margins.left + (periodPageWidth - periodTableWidth) / 2;
  const periodStartY = doc.y;

  doc.font("DejaVu-Bold").fontSize(12);
  // Заголовки
  doc.rect(periodStartX, periodStartY, periodColWidth, periodRowHeight).stroke();
  doc.text("Период", periodStartX + 5, periodStartY + 10, { width: periodColWidth - 10, align: "center" });
  doc.rect(periodStartX + periodColWidth, periodStartY, periodColWidth, periodRowHeight).stroke();
  doc.text("Возраст", periodStartX + periodColWidth + 5, periodStartY + 10, { width: periodColWidth - 10, align: "center" });

  doc.font("DejaVu-Regular").fontSize(11);
  // Данные периодов
  data.lifePeriods.forEach((period, index) => {
    const currentY = periodStartY + (index + 1) * periodRowHeight;
    
    doc.rect(periodStartX, currentY, periodColWidth, periodRowHeight).stroke();
    doc.text(`Период ${period.periodNumber}`, periodStartX + 5, currentY + 10, { width: periodColWidth - 10, align: "center" });
    
    doc.rect(periodStartX + periodColWidth, currentY, periodColWidth, periodRowHeight).stroke();
    doc.text(`${period.fromAge}-${period.toAge} лет`, periodStartX + periodColWidth + 5, currentY + 10, { width: periodColWidth - 10, align: "center" });
  });

  doc.x = doc.page.margins.left;

  doc.y = periodStartY + (data.lifePeriods.length + 1) * periodRowHeight;
  doc.moveDown(2);

  // Описание каждого периода
  data.lifePeriods.forEach((period, index) => {
    // Проверяем, нужно ли добавить новую страницу
    if (doc.y > doc.page.height - doc.page.margins.bottom - 200) {
      doc.addPage();
    }

    doc.font("DejaVu-Bold").fontSize(16).fillColor("#4b0082").text(`Период ${period.periodNumber} (${period.fromAge}-${period.toAge} лет)`, { align: "left" });
    doc.fillColor("#000000");
    doc.moveDown(0.5);

    doc.font("DejaVu-Bold").fontSize(13).text("Положительные события и бонусы и что может мешать их получению:", { align: "left" });
    doc.moveDown(0.5);
    doc.font("DejaVu-Regular").fontSize(11).text(period.positiveEvents, { align: "justify" });
    doc.moveDown(0.5);

    doc.font("DejaVu-Bold").fontSize(13).text("Кармический уроки, кармические ошибки и кармические черты характера (это нельзя повторять в данном периоде):", { align: "left" });
    doc.moveDown(0.5);
    doc.font("DejaVu-Regular").fontSize(11).text(period.karmicLessons, { align: "justify" });

    doc.moveDown(2);
  });

  doc.end();
}

export function generateStagnationCyclePdf(
  data: StagnationCycleData,
  stream: Writable,
  birthDate: string,
  chooseMonth: string
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
    .text("Удар, цикл, застой, выход", { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`Расчет для даты: ${birthDate}`, { align: "center" });
  doc
    .font("DejaVu-Regular")
    .fontSize(14)
    .text(`Месяц: ${chooseMonth}`, { align: "center" });
  doc.moveDown(3);
  

  doc.font("DejaVu-Bold").fontSize(18).text("УДАР");
  doc.moveDown(0);
  doc.font("DejaVu-Bold").fontSize(14).text(`Аркан: ${data.strike.arcanum}`);
  doc.moveDown(0.5);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.strike.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("ЦИКЛ");
  doc.moveDown(0);
  doc.font("DejaVu-Bold").fontSize(14).text(`Аркан: ${data.cycle.arcanum}`);
  doc.moveDown(0.5);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.cycle.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("ЗАСТОЙ");
  doc.moveDown(0);
  doc.font("DejaVu-Bold").fontSize(14).text(`Аркан: ${data.stagnation.arcanum}`);
  doc.moveDown(0.5);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.stagnation.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("Выход 1");
  doc.moveDown(0.5);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.exit1.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("Выход 2");
  doc.moveDown(0.5);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.exit2.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });
  doc.moveDown(3);

  doc.font("DejaVu-Bold").fontSize(18).text("Выход 3");
  doc.moveDown(0.5);
  doc
    .font("DejaVu-Regular")
    .fontSize(11)
    .text(data.exit3.text || "Трактовка появится после заполнения файла интерпретаций.", {
      align: "justify",
    });

  doc.end();
}
