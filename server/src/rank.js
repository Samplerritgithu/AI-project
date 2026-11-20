export function cosine(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function topMatches(rows, query, limit) {
  return rows
    .map(row => ({ ...row, score: cosine(row.vector, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
