export interface ParsedPasteItem {
  title: string;
  description?: string;
  isSubtask: boolean;
}

/**
 * Parse HTML clipboard data (from Google Docs, Notion, etc.) into structured items.
 * Uses nesting depth of <li> elements: shallowest depth = titles, deeper = descriptions.
 *
 * Returns null if the HTML doesn't contain useful list structure.
 */
export function parseHtmlPasteItems(html: string): ParsedPasteItem[] | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  if (!body) return null;

  // Find ALL <li> elements in the document
  const allLis = Array.from(body.querySelectorAll('li'));
  if (allLis.length === 0) return null;

  // Measure nesting depth of each <li> (count ancestor <ul>/<ol> elements)
  const liWithDepth = allLis.map((li) => ({
    el: li,
    depth: getListDepth(li),
    text: getDirectTextOfLi(li),
  })).filter((item) => item.text.length > 0);

  if (liWithDepth.length === 0) return null;

  // The shallowest depth = title items, anything deeper = description
  const minDepth = Math.min(...liWithDepth.map((item) => item.depth));

  const items: ParsedPasteItem[] = [];

  for (const { depth, text } of liWithDepth) {
    if (depth === minDepth) {
      // This is a title-level item
      items.push({ title: text, isSubtask: false });
    } else if (items.length > 0) {
      // Deeper = description of the most recent title
      const prev = items[items.length - 1];
      prev.description = prev.description ? prev.description + '\n' + text : text;
    }
  }

  return items.length > 0 ? items : null;
}

/**
 * Count how many <ul>/<ol> ancestor elements a <li> has.
 */
function getListDepth(li: Element): number {
  let depth = 0;
  let el: Element | null = li.parentElement;
  while (el) {
    const tag = el.tagName;
    if (tag === 'UL' || tag === 'OL') {
      depth++;
    }
    el = el.parentElement;
  }
  return depth;
}

/**
 * Get the text content of a <li> element, excluding text from nested <ul>/<ol> children.
 * This avoids pulling in sub-bullet text into the parent's title.
 */
function getDirectTextOfLi(li: Element): string {
  let text = '';
  for (const child of li.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent;
    } else if (child instanceof Element) {
      const tag = child.tagName;
      if (tag !== 'UL' && tag !== 'OL') {
        text += child.textContent ?? '';
      }
    }
  }
  return text.trim();
}

/**
 * Parse plain text clipboard data into structured items.
 * Non-indented lines = titles, indented lines = descriptions of the preceding title.
 * Lines with list markers at any indent level are treated as separate items.
 */
export function parsePlainTextPasteItems(text: string): ParsedPasteItem[] | null {
  const rawLines = text.split(/\r?\n/);
  const nonEmptyLines = rawLines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length < 2) return null;

  const listMarkerRe = /^[-*+]|\d+[.)]\s*/;
  const items: ParsedPasteItem[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const leadingMatch = raw.match(/^(\s*)/);
    const leading = leadingMatch ? leadingMatch[1].replace(/\t/g, '  ') : '';
    const indentLevel = leading.length;
    const hasMarker = listMarkerRe.test(trimmed);

    const cleaned = trimmed
      .replace(/^(?:[-*+]|\d+[.)]\s*|#{1,6}\s+)\s*/, '')
      .trim();
    if (!cleaned) continue;

    // Indented line without a list marker = description of previous item
    if (indentLevel > 0 && !hasMarker && items.length > 0) {
      const prev = items[items.length - 1];
      prev.description = prev.description ? prev.description + '\n' + cleaned : cleaned;
      continue;
    }

    items.push({ title: cleaned, isSubtask: false });
  }

  return items.length > 0 ? items : null;
}

/**
 * Full paste parser: tries HTML first (for Google Docs, Notion, etc.),
 * falls back to plain text.
 */
export function parsePastedItems(clipboardData: DataTransfer): ParsedPasteItem[] | null {
  const html = clipboardData.getData('text/html');
  if (html) {
    const items = parseHtmlPasteItems(html);
    if (items && items.length > 0) return items;
  }

  const text = clipboardData.getData('text/plain');
  return parsePlainTextPasteItems(text);
}
