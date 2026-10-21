const PDFDocument = require('pdfkit');

function csvCell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function sendCsv(res, filename, columns, rows) {
  const csv = [
    columns.map((column) => csvCell(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(',')),
  ].join('\r\n');
  return res.attachment(filename).type('text/csv').send(`\uFEFF${csv}`);
}

function sendPdf(res, { filename, title, subtitle, columns, rows }) {
  const document = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.attachment(filename).type('application/pdf');
  document.pipe(res);
  document.font('Helvetica-Bold').fontSize(18).fillColor('#183454').text(title);
  document.moveDown(0.5);
  document.font('Helvetica').fontSize(9).fillColor('#555').text(subtitle);
  document.moveDown();

  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const columnWidth = (right - left) / columns.length;
  const rowHeight = 23;
  let y = document.y;

  function drawRow(values, bold = false) {
    if (y + rowHeight > document.page.height - document.page.margins.bottom) {
      document.addPage();
      y = document.page.margins.top;
      drawHeader();
    }
    values.forEach((value, index) => {
      const maxCharacters = Math.max(8, Math.floor((columnWidth - 8) / 4.5));
      const text = String(value ?? '');
      const display = text.length > maxCharacters
        ? `${text.slice(0, maxCharacters - 1)}…`
        : text;
      document.font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .fillColor('#222')
        .text(display, left + index * columnWidth, y + 5, {
          width: columnWidth - 8,
          lineBreak: false,
        });
    });
    y += rowHeight;
    document.moveTo(left, y).lineTo(right, y).strokeColor('#dddddd').stroke();
  }

  function drawHeader() {
    drawRow(columns.map((column) => column.label), true);
  }

  drawHeader();
  for (const row of rows) drawRow(columns.map((column) => row[column.key]));
  document.end();
}

module.exports = { sendCsv, sendPdf };
