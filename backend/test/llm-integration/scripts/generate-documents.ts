import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

// Ensure samples directory exists
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

// ========== PDF: Czech Invoice (Multi-page) ==========
async function generateInvoicePDF() {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const outputPath = path.join(SAMPLES_DIR, 'invoice-czech.pdf');
  doc.pipe(fs.createWriteStream(outputPath));

  // Page 1: Main Invoice
  doc.font('Helvetica-Bold').fontSize(24).text('FAKTURA č. 2024-001234', { align: 'center' });
  doc.moveDown(2);

  // Supplier Info
  doc.fontSize(14).text('DODAVATEL:');
  doc.fontSize(11).font('Helvetica')
    .text('ABC Software s.r.o.')
    .text('Technická 15')
    .text('110 00 Praha 1')
    .text('IČO: 12345678')
    .text('DIČ: CZ12345678');
  doc.moveDown();

  // Customer Info
  doc.font('Helvetica-Bold').fontSize(14).text('ODBĚRATEL:');
  doc.fontSize(11).font('Helvetica')
    .text('XYZ Corporation a.s.')
    .text('Průmyslová 42')
    .text('602 00 Brno')
    .text('IČO: 87654321')
    .text('DIČ: CZ87654321');
  doc.moveDown();

  // Dates
  doc.font('Helvetica-Bold').text('Datum vystavení: ', { continued: true })
    .font('Helvetica').text('15.11.2024');
  doc.font('Helvetica-Bold').text('Datum splatnosti: ', { continued: true })
    .font('Helvetica').text('30.11.2024');
  doc.font('Helvetica-Bold').text('Způsob úhrady: ', { continued: true })
    .font('Helvetica').text('Bankovní převod');
  doc.moveDown(2);

  // Items Table
  doc.font('Helvetica-Bold').fontSize(14).text('POLOŽKY:');
  doc.moveDown();

  const items = [
    { desc: 'Vývoj webové aplikace', qty: '120 hod', price: '1 500 Kč', total: '180 000 Kč' },
    { desc: 'Testování a QA', qty: '40 hod', price: '1 200 Kč', total: '48 000 Kč' },
    { desc: 'Dokumentace', qty: '20 hod', price: '1 000 Kč', total: '20 000 Kč' },
    { desc: 'Licence Enterprise', qty: '1 ks', price: '25 000 Kč', total: '25 000 Kč' },
  ];

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Popis', 50, doc.y, { width: 200 });
  doc.text('Množství', 250, doc.y - 12, { width: 80 });
  doc.text('Jedn. cena', 330, doc.y - 12, { width: 80 });
  doc.text('Celkem', 410, doc.y - 12, { width: 80 });
  doc.moveDown();

  doc.font('Helvetica').fontSize(10);
  items.forEach((item) => {
    const y = doc.y;
    doc.text(item.desc, 50, y, { width: 200 });
    doc.text(item.qty, 250, y, { width: 80 });
    doc.text(item.price, 330, y, { width: 80 });
    doc.text(item.total, 410, y, { width: 80 });
    doc.moveDown();
  });

  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('Mezisoučet:', 330, doc.y, { continued: true }).text('  273 000 Kč');
  doc.text('DPH 21%:', 330, doc.y, { continued: true }).text('     57 330 Kč');
  doc.moveDown();
  doc.fontSize(14).text('CELKEM K ÚHRADĚ:', 280, doc.y, { continued: true }).text('  330 330 Kč');

  // Page 2: Banking Details and Terms
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(16).text('PLATEBNÍ ÚDAJE', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(12).font('Helvetica-Bold').text('Bankovní spojení:');
  doc.font('Helvetica').fontSize(11)
    .text('Česká spořitelna a.s.')
    .text('Číslo účtu: 1234567890/0800')
    .text('IBAN: CZ65 0800 0000 1234 5678 90')
    .text('SWIFT: GIBACZPX')
    .text('Variabilní symbol: 2024001234');
  doc.moveDown(2);

  doc.font('Helvetica-Bold').fontSize(12).text('OBCHODNÍ PODMÍNKY:');
  doc.font('Helvetica').fontSize(10);
  doc.text('1. Fakturovaná částka je splatná do 15 dnů od data vystavení faktury.');
  doc.text('2. V případě prodlení s úhradou si vyhrazujeme právo účtovat úrok z prodlení ve výši 0,05% z dlužné částky za každý den prodlení.');
  doc.text('3. Vlastnické právo k dodanému softwaru přechází na kupujícího až po úplném zaplacení kupní ceny.');
  doc.text('4. Reklamace musí být uplatněna písemně do 7 dnů od zjištění vady.');
  doc.text('5. Smluvní strany se dohodly na řešení sporů přednostně mimosoudní cestou.');
  doc.moveDown(2);

  doc.font('Helvetica-Bold').fontSize(12).text('POPIS DODANÝCH SLUŽEB:');
  doc.font('Helvetica').fontSize(10);
  doc.text('V rámci projektu "E-commerce Platform v2.0" byly realizovány následující práce:');
  doc.moveDown();
  doc.text('• Analýza požadavků a návrh architektury systému');
  doc.text('• Implementace uživatelského rozhraní v React 18');
  doc.text('• Vývoj REST API v Node.js s Express frameworkem');
  doc.text('• Integrace platební brány a bezpečnostních prvků');
  doc.text('• Optimalizace databázových dotazů PostgreSQL');
  doc.text('• Nasazení na produkční servery s Docker kontejnery');
  doc.text('• Konfigurace monitoringu a logování');
  doc.text('• Školení koncových uživatelů');

  doc.moveDown(3);
  doc.fontSize(10).text('Děkujeme za spolupráci!', { align: 'center' });
  doc.text('ABC Software s.r.o.', { align: 'center' });

  doc.end();
  console.log('✓ Generated: invoice-czech.pdf');
}

// ========== Excel: Technical Report Data ==========
async function generateTechnicalReportExcel() {
  const workbook = new ExcelJS.Workbook();
  const outputPath = path.join(SAMPLES_DIR, 'technical-report.xlsx');

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Shrnutí');
  summarySheet.columns = [
    { header: 'Metrika', key: 'metric', width: 40 },
    { header: 'Hodnota', key: 'value', width: 20 },
    { header: 'Jednotka', key: 'unit', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  summarySheet.addRows([
    { metric: 'Maximální souběžní uživatelé', value: 15000, unit: 'users', status: 'OK' },
    { metric: 'Průměrný počet req/s', value: 3200, unit: 'req/s', status: 'OK' },
    { metric: 'Špičková zátěž', value: 8500, unit: 'req/s', status: 'OK' },
    { metric: 'Průměrné využití CPU', value: 65, unit: '%', status: 'OK' },
    { metric: 'Špičkové využití CPU', value: 85, unit: '%', status: 'WARNING' },
    { metric: 'Využití RAM', value: 12, unit: 'GB', status: 'OK' },
    { metric: 'Disk I/O Write', value: 150, unit: 'MB/s', status: 'OK' },
    { metric: 'Disk I/O Read', value: 450, unit: 'MB/s', status: 'OK' },
    { metric: 'Síťová propustnost', value: 2.1, unit: 'Gbps', status: 'OK' },
    { metric: 'Cache miss rate', value: 23, unit: '%', status: 'CRITICAL' },
  ]);

  // Sheet 2: API Response Times
  const apiSheet = workbook.addWorksheet('API Odezvy');
  apiSheet.columns = [
    { header: 'Endpoint', key: 'endpoint', width: 30 },
    { header: 'Metoda', key: 'method', width: 10 },
    { header: 'Průměr (ms)', key: 'avg', width: 15 },
    { header: '95. percentil (ms)', key: 'p95', width: 20 },
    { header: '99. percentil (ms)', key: 'p99', width: 20 },
    { header: 'Max (ms)', key: 'max', width: 15 },
  ];

  apiSheet.addRows([
    { endpoint: '/api/products', method: 'GET', avg: 45, p95: 120, p99: 250, max: 580 },
    { endpoint: '/api/products/:id', method: 'GET', avg: 32, p95: 85, p99: 150, max: 320 },
    { endpoint: '/api/orders', method: 'POST', avg: 180, p95: 450, p99: 820, max: 1500 },
    { endpoint: '/api/orders/:id', method: 'GET', avg: 28, p95: 65, p99: 120, max: 280 },
    { endpoint: '/api/search', method: 'GET', avg: 85, p95: 250, p99: 480, max: 950 },
    { endpoint: '/api/cart', method: 'POST', avg: 95, p95: 220, p99: 410, max: 780 },
    { endpoint: '/api/cart', method: 'GET', avg: 35, p95: 90, p99: 165, max: 350 },
    { endpoint: '/api/users/auth', method: 'POST', avg: 120, p95: 280, p99: 520, max: 980 },
    { endpoint: '/api/inventory', method: 'GET', avg: 55, p95: 140, p99: 260, max: 520 },
    { endpoint: '/api/inventory/update', method: 'PUT', avg: 210, p95: 520, p99: 980, max: 1800 },
  ]);

  // Sheet 3: Issues
  const issuesSheet = workbook.addWorksheet('Problémy');
  issuesSheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Závažnost', key: 'severity', width: 15 },
    { header: 'Komponenta', key: 'component', width: 25 },
    { header: 'Popis', key: 'description', width: 50 },
    { header: 'Dopad', key: 'impact', width: 30 },
    { header: 'Priorita řešení', key: 'priority', width: 15 },
    { header: 'Odhad (dny)', key: 'estimate', width: 15 },
  ];

  issuesSheet.addRows([
    { id: 'ISS-001', severity: 'KRITICKÁ', component: 'Order Service', description: 'Memory leak v order processing service - únik 50MB/hod', impact: 'Pád služby po 24h provozu', priority: 'P1', estimate: 3 },
    { id: 'ISS-002', severity: 'KRITICKÁ', component: 'Inventory', description: 'Deadlock při konkurentním přístupu k inventory', impact: 'Blokování objednávek', priority: 'P1', estimate: 2 },
    { id: 'ISS-003', severity: 'VYSOKÁ', component: 'Database', description: 'Pomalé dotazy při >10K produktech', impact: 'Degradace výkonu', priority: 'P2', estimate: 4 },
    { id: 'ISS-004', severity: 'VYSOKÁ', component: 'Redis Cache', description: 'Cache miss rate 23% (cíl <10%)', impact: 'Zvýšená zátěž DB', priority: 'P2', estimate: 3 },
    { id: 'ISS-005', severity: 'STŘEDNÍ', component: 'PostgreSQL', description: 'Chybějící indexy na často používaných sloupcích', impact: 'Pomalejší dotazy', priority: 'P3', estimate: 1 },
    { id: 'ISS-006', severity: 'STŘEDNÍ', component: 'Frontend', description: 'Zbytečné API volání při načítání produktů', impact: 'Zvýšená latence', priority: 'P3', estimate: 2 },
    { id: 'ISS-007', severity: 'NÍZKÁ', component: 'Monitoring', description: 'Chybějící metriky pro business KPIs', impact: 'Omezená viditelnost', priority: 'P4', estimate: 3 },
  ]);

  // Sheet 4: Recommendations
  const recsSheet = workbook.addWorksheet('Doporučení');
  recsSheet.columns = [
    { header: 'Časový horizont', key: 'timeframe', width: 20 },
    { header: 'Doporučení', key: 'recommendation', width: 60 },
    { header: 'Očekávaný přínos', key: 'benefit', width: 40 },
    { header: 'Náročnost', key: 'effort', width: 15 },
  ];

  recsSheet.addRows([
    { timeframe: 'Okamžitě (1 týden)', recommendation: 'Opravit memory leak v order service', benefit: 'Stabilita služby', effort: 'Střední' },
    { timeframe: 'Okamžitě (1 týden)', recommendation: 'Implementovat optimistic locking pro inventory', benefit: 'Eliminace deadlocků', effort: 'Střední' },
    { timeframe: 'Okamžitě (1 týden)', recommendation: 'Přidat chybějící databázové indexy', benefit: '30% zrychlení dotazů', effort: 'Nízká' },
    { timeframe: 'Krátkodobě (1 měsíc)', recommendation: 'Refaktorovat cache strategii', benefit: 'Snížení cache miss na <10%', effort: 'Vysoká' },
    { timeframe: 'Krátkodobě (1 měsíc)', recommendation: 'Optimalizovat Elasticsearch queries', benefit: '50% zrychlení vyhledávání', effort: 'Střední' },
    { timeframe: 'Krátkodobě (1 měsíc)', recommendation: 'Implementovat connection pooling', benefit: 'Lepší využití zdrojů', effort: 'Střední' },
    { timeframe: 'Dlouhodobě (3 měsíce)', recommendation: 'Přechod na microservices architekturu', benefit: 'Nezávislé škálování', effort: 'Velmi vysoká' },
    { timeframe: 'Dlouhodobě (3 měsíce)', recommendation: 'Implementace CQRS patternu', benefit: 'Oddělení čtení/zápisu', effort: 'Vysoká' },
    { timeframe: 'Dlouhodobě (3 měsíce)', recommendation: 'Horizontální škálování databáze', benefit: 'Neomezená kapacita', effort: 'Velmi vysoká' },
  ]);

  await workbook.xlsx.writeFile(outputPath);
  console.log('✓ Generated: technical-report.xlsx');
}

// ========== Word: Meeting Notes ==========
async function generateMeetingNotesWord() {
  const outputPath = path.join(SAMPLES_DIR, 'meeting-notes.docx');

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: 'ZÁPIS Z PORADY - SPRINT PLANNING Q4 2024',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),

        // Meeting Info
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Datum: ', bold: true }),
            new TextRun('12.11.2024, 10:00 - 12:30'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Místo: ', bold: true }),
            new TextRun('Zasedací místnost A, Praha'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Online: ', bold: true }),
            new TextRun('Teams meeting ID: 987654321'),
          ],
        }),

        // Attendees
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'ÚČASTNÍCI:',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '• Petr Svoboda (Product Owner) - přítomen' }),
        new Paragraph({ text: '• Marie Dvořáková (Scrum Master) - přítomna' }),
        new Paragraph({ text: '• Tomáš Horák (Tech Lead) - přítomen' }),
        new Paragraph({ text: '• Eva Procházková (Frontend Developer) - online' }),
        new Paragraph({ text: '• Martin Krejčí (Backend Developer) - přítomen' }),
        new Paragraph({ text: '• Jana Němcová (QA Engineer) - online' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Omluveni: ', bold: true }),
            new TextRun('Pavel Malý (DevOps)'),
          ],
        }),

        // Agenda
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'AGENDA:',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '1. Rekapitulace předchozího sprintu' }),
        new Paragraph({ text: '2. Backlog grooming' }),
        new Paragraph({ text: '3. Plánování sprintu 2024-Q4-03' }),
        new Paragraph({ text: '4. Diskuze o technickém dluhu' }),
        new Paragraph({ text: '5. Různé' }),

        // Previous Sprint Review
        new Paragraph({ text: '' }),
        new Paragraph({
          text: '1. REKAPITULACE SPRINTU 2024-Q4-02',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Velocity: ', bold: true }),
            new TextRun('42 story points (cíl byl 45)'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Dokončené user stories: ', bold: true }),
            new TextRun('8 z 10'),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Nedokončeno: ', bold: true }),
          ],
        }),
        new Paragraph({ text: '• US-234 (User dashboard redesign) - přesun do dalšího sprintu' }),
        new Paragraph({ text: '• US-245 (Payment gateway integration) - blokováno externím dodavatelem' }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Tomáš: ', bold: true, italics: true }),
            new TextRun({ text: '"US-245 je blokováno, protože dodavatel PayGate ještě neposkytl API dokumentaci. Očekáváme ji do konce týdne."', italics: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Petr: ', bold: true, italics: true }),
            new TextRun({ text: '"Prioritizujme US-234, protože máme zpětnou vazbu od zákazníků, že dashboard je nepřehledný."', italics: true }),
          ],
        }),

        // Backlog Grooming
        new Paragraph({ text: '' }),
        new Paragraph({
          text: '2. BACKLOG GROOMING',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: 'Přehodnocené položky:' }),
        new Paragraph({ text: '• US-250: Export dat do PDF - zvýšena priorita (stakeholder request)' }),
        new Paragraph({ text: '• US-251: Multi-tenant support - odloženo na Q1 2025' }),
        new Paragraph({ text: '• US-252: Performance monitoring dashboard - přidáno do backlogu' }),

        // Sprint Planning
        new Paragraph({ text: '' }),
        new Paragraph({
          text: '3. SPRINT 2024-Q4-03 PLÁNOVÁNÍ',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Cíl sprintu: ', bold: true }),
            new TextRun({ text: '"Dokončit user dashboard a implementovat export funkcionalitu"', italics: true }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Vybrané user stories:', bold: true })] }),

        // User Stories Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'User Story', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Story Points', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Assignee', bold: true })] })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('US-234: User dashboard redesign')] }),
                new TableCell({ children: [new Paragraph('13')] }),
                new TableCell({ children: [new Paragraph('Eva, Martin')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('US-250: Export dat do PDF')] }),
                new TableCell({ children: [new Paragraph('8')] }),
                new TableCell({ children: [new Paragraph('Martin')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('US-253: Automatické notifikace')] }),
                new TableCell({ children: [new Paragraph('8')] }),
                new TableCell({ children: [new Paragraph('Tomáš')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('US-254: Bug fixes z produkce')] }),
                new TableCell({ children: [new Paragraph('5')] }),
                new TableCell({ children: [new Paragraph('Eva')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('US-255: Unit test coverage improvement')] }),
                new TableCell({ children: [new Paragraph('8')] }),
                new TableCell({ children: [new Paragraph('Jana')] }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Celkem: ', bold: true }),
            new TextRun('42 story points (konzervativní odhad)'),
          ],
        }),

        // Technical Debt
        new Paragraph({ text: '' }),
        new Paragraph({
          text: '4. TECHNICKÝ DLUH',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: 'Identifikované položky:' }),
        new Paragraph({ text: '• Legacy API endpoints (2 dny práce)' }),
        new Paragraph({ text: '• Deprecated dependencies aktualizace (1 den)' }),
        new Paragraph({ text: '• Database schema refactoring (3 dny)' }),
        new Paragraph({ text: '• Code documentation (2 dny)' }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Rozhodnutí: ', bold: true }),
            new TextRun('Alokovat 20% kapacity každého sprintu na technický dluh'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Marie: ', bold: true, italics: true }),
            new TextRun({ text: '"Musíme být systematičtí, jinak nám technický dluh přeroste přes hlavu."', italics: true }),
          ],
        }),

        // Various
        new Paragraph({ text: '' }),
        new Paragraph({
          text: '5. RŮZNÉ',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '• Nový team member nastupuje 1.12.2024 (Junior Developer)' }),
        new Paragraph({ text: '• Vánoční večírek 20.12.2024 - hlasování o místě' }),
        new Paragraph({ text: '• Code review guidelines budou aktualizovány - Tomáš pošle draft do konce týdne' }),

        // Action Items
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'AKČNÍ POLOŽKY:',
          heading: HeadingLevel.HEADING_2,
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ID', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Úkol', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Odpovědný', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Termín', bold: true })] })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('AP-1')] }),
                new TableCell({ children: [new Paragraph('Kontaktovat PayGate ohledně API dokumentace')] }),
                new TableCell({ children: [new Paragraph('Tomáš')] }),
                new TableCell({ children: [new Paragraph('15.11.2024')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('AP-2')] }),
                new TableCell({ children: [new Paragraph('Připravit mockupy pro US-234')] }),
                new TableCell({ children: [new Paragraph('Eva')] }),
                new TableCell({ children: [new Paragraph('13.11.2024')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('AP-3')] }),
                new TableCell({ children: [new Paragraph('Nastavit test environment pro sprint')] }),
                new TableCell({ children: [new Paragraph('Jana')] }),
                new TableCell({ children: [new Paragraph('14.11.2024')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('AP-4')] }),
                new TableCell({ children: [new Paragraph('Rozeslat pozvánky na retrospektivu')] }),
                new TableCell({ children: [new Paragraph('Marie')] }),
                new TableCell({ children: [new Paragraph('13.11.2024')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('AP-5')] }),
                new TableCell({ children: [new Paragraph('Aktualizovat roadmap pro stakeholders')] }),
                new TableCell({ children: [new Paragraph('Petr')] }),
                new TableCell({ children: [new Paragraph('18.11.2024')] }),
              ],
            }),
          ],
        }),

        // Next Meetings
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'DALŠÍ SCHŮZKY:',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '• Daily standup: každý den 9:30' }),
        new Paragraph({ text: '• Sprint review: 29.11.2024, 14:00' }),
        new Paragraph({ text: '• Retrospektiva: 29.11.2024, 15:30' }),

        // Footer
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Zápis vyhotovila: ', bold: true }),
            new TextRun('Marie Dvořáková'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Schválil: ', bold: true }),
            new TextRun('Petr Svoboda'),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log('✓ Generated: meeting-notes.docx');
}

// Main execution
async function main() {
  console.log('Generating sample documents...\n');

  try {
    await generateInvoicePDF();
    await generateTechnicalReportExcel();
    await generateMeetingNotesWord();

    console.log('\n✅ All documents generated successfully!');
    console.log(`Files are located in: ${SAMPLES_DIR}`);
  } catch (error) {
    console.error('Error generating documents:', error);
    process.exit(1);
  }
}

main();
