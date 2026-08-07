/**
 * Выгрузка анкеты заёмщика в PDF и Word.
 * Обе библиотеки (pdfmake ~2 МБ со шрифтом Roboto/кириллицей и docx)
 * загружаются лениво отдельными чанками только по клику на скачивание.
 */

export type AnketaSummary = Array<{ title: string; rows: Array<[string, string]> }>;

function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** PDF через pdfmake: Roboto из vfs (кириллица из коробки). */
export async function exportAnketaPdf(summary: AnketaSummary): Promise<void> {
  const pdfMakeMod: any = await import('pdfmake/build/pdfmake');
  const fontsMod: any = await import('pdfmake/build/vfs_fonts');
  const pdfMake = pdfMakeMod.default ?? pdfMakeMod;
  const vfs = fontsMod.default?.pdfMake?.vfs ?? fontsMod.pdfMake?.vfs
    ?? fontsMod.default?.vfs ?? fontsMod.vfs ?? fontsMod.default ?? fontsMod;
  if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
  else pdfMake.vfs = vfs;

  const content: unknown[] = [
    { text: 'Анкета заёмщика', fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
    { text: 'Сформирована ' + new Date().toLocaleDateString('ru-RU'), fontSize: 9, color: '#6A6A6A', margin: [0, 0, 0, 14] },
  ];
  for (const sec of summary) {
    content.push({ text: sec.title, fontSize: 13, bold: true, margin: [0, 10, 0, 6] });
    content.push({
      table: {
        widths: ['38%', '62%'],
        body: sec.rows.map(([k, v]) => ([
          { text: k, fontSize: 10, color: '#6A6A6A' },
          { text: v, fontSize: 10, bold: true },
        ])),
      },
      layout: {
        hLineColor: () => '#E5E5E5', vLineColor: () => '#FFFFFF',
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        paddingTop: () => 5, paddingBottom: () => 5,
      },
    });
  }

  pdfMake.createPdf({
    content,
    pageMargins: [36, 36, 36, 36],
    defaultStyle: { font: 'Roboto' },
  }).download('anketa-zaemshchika.pdf');
}

/** Word (.docx) через пакет docx. */
export async function exportAnketaDocx(summary: AnketaSummary): Promise<void> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;

  const border = { style: BorderStyle.SINGLE, size: 2, color: 'E5E5E5' };
  const children: unknown[] = [
    new Paragraph({ children: [new TextRun({ text: 'Анкета заёмщика', bold: true, size: 34 })] }),
    new Paragraph({ children: [new TextRun({
      text: 'Сформирована ' + new Date().toLocaleDateString('ru-RU'), size: 18, color: '6A6A6A',
    })], spacing: { after: 240 } }),
  ];

  for (const sec of summary) {
    children.push(new Paragraph({
      children: [new TextRun({ text: sec.title, bold: true, size: 26 })],
      spacing: { before: 240, after: 120 },
    }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: sec.rows.map(([k, v]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new Paragraph({ children: [new TextRun({ text: k, color: '6A6A6A', size: 20 })] })],
          }),
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new Paragraph({ children: [new TextRun({ text: v, bold: true, size: 20 })] })],
          }),
        ],
      })),
    }));
  }

  const doc = new Document({ sections: [{ children: children as never[] }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, 'anketa-zaemshchika.docx');
}
