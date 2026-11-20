// ~1800 characters is a few hundred tokens: enough to hold one idea,
// small enough that a question usually lands on a single passage.
// The overlap is so a sentence sitting on the cut still shows up whole.
const TARGET = 1800;
const OVERLAP = 220;

export function chunkText(raw) {
  const text = normalize(raw);
  if (!text) return [];
  const packed = pack(splitBlocks(text));
  return withOverlap(packed);
}

function normalize(raw) {
  return String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitBlocks(text) {
  const units = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    const flat = paragraph.replace(/\s+/g, ' ').trim();
    if (!flat) continue;
    if (flat.length <= TARGET) {
      units.push(flat);
      continue;
    }
    // Capital after the space avoids chopping "3.14" into its own piece.
    const sentences = flat.split(/(?<=[.!?])\s+(?=[A-Z"“])/);
    for (const sentence of sentences) {
      if (!sentence) continue;
      if (sentence.length <= TARGET) {
        units.push(sentence);
        continue;
      }
      for (let i = 0; i < sentence.length; i += TARGET) {
        units.push(sentence.slice(i, i + TARGET));
      }
    }
  }
  return units;
}

function pack(units) {
  const chunks = [];
  let current = '';
  for (const unit of units) {
    if (!current) {
      current = unit;
      continue;
    }
    const next = `${current}\n\n${unit}`;
    if (next.length <= TARGET) current = next;
    else {
      chunks.push(current);
      current = unit;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function withOverlap(chunks) {
  return chunks.map((content, index) => {
    if (index === 0) return { index, content };
    const tail = chunks[index - 1].slice(-OVERLAP).trim();
    if (!tail || content.startsWith(tail)) return { index, content };
    return { index, content: `${tail}\n\n${content}` };
  });
}
