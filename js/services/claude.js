// Optional AI step: when the page runs inside Claude, ask Claude to pick shadowable material
// from a lesson (from page images or OCR text). Outside Claude this resolves to null and the
// app falls back to the offline heuristic in core/text.js.

let sampleP = null;
/** The Claude "sample" capability, or null when not running inside Claude. */
export function getClaude() {
  if (!sampleP) sampleP = (async () => {
    try {
      if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return null;
      return (await window.claude.use('sample')) || null;
    } catch (e) { return null; }
  })();
  return sampleP;
}

/** How many images one request may carry (0 = images not supported). */
export async function imageBatchSize(claude) {
  try {
    const lim = claude && claude.limits ? await claude.limits() : null;
    if (!lim || !lim.images) return 0;
    return typeof lim.images === 'number' ? Math.max(1, Math.min(lim.images, 8)) : 6;
  } catch (e) { return 0; }
}

/** The instruction sent to Claude. Exported for tests and review. */
export function selectionPrompt({ langName, level, mode, noteLanguage, persianLearner }) {
  return `You are helping a ${persianLearner ? 'Persian-speaking ' : ''}learner practise ${langName} with the shadowing method (listen and repeat aloud along with audio). Their level is ${level}.
Below ${mode === 'images' ? 'are photos/scans of pages from one lesson of their textbook' : 'is the text of one lesson of their textbook, produced by OCR, so it may contain recognition errors'}.

Select ONLY the material worth shadowing:
- dialogues and conversations,
- reading texts, short stories, descriptions, emails/letters,
- blocks of useful everyday expressions (greetings, introducing yourself, asking for things, shopping, ordering, appointments…),
- texts about daily routines / everyday life.
Skip: exercise and task instructions, gap-fill sentences, multiple choice, word lists, single words, grammar tables, headers, page numbers, captions without full sentences, answer keys.

Rules:
- Copy passages faithfully from the book. Fix only obvious OCR/scan errors. Never invent, translate or rewrite content.
- Remove speaker labels ("A:", "Anna:") and list numbering, but keep each spoken turn or phrase on its own line.
- Every line must be a full sentence ending with sentence punctuation (add a final period to a phrase if missing).
${/A1|A2/.test(level) ? '- The learner is a beginner: prefer short, high-frequency, immediately useful sentences.\n' : ''}- Keep the book's order. At most 12 items.
- For each item: "type" = dialogue | reading | phrases | routine; "title" = short title in ${langName}; "note" = one short ${noteLanguage} sentence saying what it is useful for; "text" = the lines joined with \\n.

Answer with JSON only: {"lesson": "lesson name/number if visible, else empty", "items": [{"type": "...", "title": "...", "note": "...", "text": "..."}]}. If nothing is suitable, return an empty items array.`;
}

/**
 * Runs the selection. Pass either `text` or `images` (Blobs, sent in batches).
 * @returns {{lesson: string, items: Array<{type,title,note,text}>, raw: string}}
 */
export async function selectMaterial({ claude, text, images, batch, promptArgs, onBatch }) {
  const ask = async (txt, imgs) => {
    let prompt = selectionPrompt({ ...promptArgs, mode: imgs ? 'images' : 'text' });
    if (txt) prompt += `\n\n<lesson_text>\n${txt.slice(0, 60000)}\n</lesson_text>`;
    const opts = { modelTier: 'default' }; if (imgs) opts.images = imgs;
    const v = await claude.json(prompt, opts);
    return (v && typeof v === 'object') ? v : {};
  };
  let lesson = '', items = [];
  if (images) {
    for (let i = 0; i < images.length; i += batch) {
      if (onBatch) onBatch(Math.min(i + batch, images.length), images.length);
      const v = await ask('', images.slice(i, i + batch));
      if (!lesson && v.lesson) lesson = v.lesson;
      items = items.concat(Array.isArray(v.items) ? v.items : []);
    }
  } else {
    const v = await ask(text); lesson = v.lesson || ''; items = Array.isArray(v.items) ? v.items : [];
  }
  items = items.filter(x => x && typeof x.text === 'string' && x.text.trim());
  return { lesson: String(lesson || ''), items, raw: text || '' };
}
