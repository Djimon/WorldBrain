import { Document, Font, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';

Font.register({ family: 'Helvetica', src: 'Helvetica' });
Font.register({ family: 'Times-Roman', src: 'Times-Roman' });

export interface CardData {
  id: string;
  entity_id?: string;
  template_id?: string;
  audience?: string;
  label?: string;
  category?: string;
  size_mm?: { width_mm: number; height_mm: number };
  fields?: Record<string, unknown>;
}

const MM_TO_PT = 2.8346;

function cardDocument(card: CardData, cutMarks = false) {
  const size = card.size_mm ?? { width_mm: 63, height_mm: 88 };
  const width = size.width_mm * MM_TO_PT;
  const height = size.height_mm * MM_TO_PT;

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: [width, height] },
      createElement(
        View,
        { style: { padding: 8, fontFamily: 'Helvetica' } },
        createElement(Text, { style: { fontSize: 10, fontWeight: 'bold' } }, card.label ?? card.fields?.name as string ?? ''),
        card.fields?.summary
          ? createElement(Text, { style: { fontSize: 8, marginTop: 4 } }, card.fields.summary as string)
          : null,
        cutMarks
          ? createElement(View, { style: { borderTop: '0.5pt solid #999', marginTop: 4 } })
          : null,
      ),
    ),
  );
}

export async function exportCardToPdf(opts: { card: CardData }): Promise<Buffer> {
  return renderToBuffer(cardDocument(opts.card)) as Promise<Buffer>;
}

export async function exportPrintSheetToPdf(opts: { cards: CardData[]; cutMarks?: boolean }): Promise<Buffer> {
  const { cards, cutMarks = false } = opts;
  const pageWidth = 595;
  const pageHeight = 842;
  const cols = 3;
  const rows = 3;
  const cellW = pageWidth / cols;
  const cellH = pageHeight / rows;

  const doc = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: [pageWidth, pageHeight] },
      createElement(
        View,
        { style: { flexDirection: 'row', flexWrap: 'wrap' } },
        ...cards.map((card, i) =>
          createElement(
            View,
            {
              key: card.id ?? i,
              style: { width: cellW, height: cellH, padding: 4, fontFamily: 'Helvetica' },
            },
            createElement(Text, { style: { fontSize: 8 } }, card.label ?? card.fields?.name as string ?? ''),
            cutMarks
              ? createElement(View, {
                  style: {
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    borderTop: '0.5pt dashed #ccc',
                  },
                })
              : null,
          ),
        ),
      ),
    ),
  );

  return renderToBuffer(doc) as Promise<Buffer>;
}
