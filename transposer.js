// ── Instrument definitions ─────────────────────────────────────────────────
// concertOffset = semitones to ADD to concert pitch to get written pitch
// e.g. Bb trumpet: concert Bb -> written C, so offset = +2

const INSTRUMENTS = [
  { label: "Concert pitch (C) - Piano / Guitar / Flute",     key: "C",  concertOffset: 0  },
  { label: "Trumpet (Bb)",                                   key: "Bb", concertOffset: 2  },
  { label: "Clarinet (Bb)",                                  key: "Bb", concertOffset: 2  },
  { label: "Soprano Sax (Bb)",                               key: "Bb", concertOffset: 2  },
  { label: "Tenor Sax (Bb)",                                 key: "Bb", concertOffset: 2  },
  { label: "Alto Sax (Eb)",                                  key: "Eb", concertOffset: -3 },
  { label: "Baritone Sax (Eb)",                              key: "Eb", concertOffset: -3 },
  { label: "French Horn (F)",                                key: "F",  concertOffset: 7  },
  { label: "English Horn (F)",                               key: "F",  concertOffset: 7  },
  { label: "Cor Anglais (F)",                                key: "F",  concertOffset: 7  },
  { label: "Alto Flute (G)",                                 key: "G",  concertOffset: 5  },
  { label: "Baritone Horn / Euphonium (Bb TC)",              key: "Bb", concertOffset: 2  },
  { label: "Tuba (C)",                                       key: "C",  concertOffset: 0  },
  { label: "Eb Cornet / Soprano Cornet (Eb)",                key: "Eb", concertOffset: -3 },
  { label: "Key: C",                                         key: "C",  concertOffset: 0  },
  { label: "Key: Bb",                                        key: "Bb", concertOffset: 2  },
  { label: "Key: Eb",                                        key: "Eb", concertOffset: -3 },
  { label: "Key: F",                                         key: "F",  concertOffset: 7  },
  { label: "Key: G",                                         key: "G",  concertOffset: 5  },
  { label: "Key: A",                                         key: "A",  concertOffset: 3  },
  { label: "Key: D",                                         key: "D",  concertOffset: -2 },
  { label: "Key: Ab",                                        key: "Ab", concertOffset: -4 },
  { label: "Key: Db",                                        key: "Db", concertOffset: 5  },
];

const PREFER_FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];

// ── Music theory helpers ───────────────────────────────────────────────────
const SHARP_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_NOTES  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function noteIndex(n) {
  const i = SHARP_NOTES.indexOf(n);
  return i >= 0 ? i : FLAT_NOTES.indexOf(n);
}

function transposeNote(note, semitones, preferFlat) {
  const idx = noteIndex(note);
  if (idx < 0) return note;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return preferFlat ? FLAT_NOTES[newIdx] : SHARP_NOTES[newIdx];
}

function getSemitones(fromIdx, toIdx) {
  const st = (INSTRUMENTS[toIdx].concertOffset - INSTRUMENTS[fromIdx].concertOffset) % 12;
  return st > 6 ? st - 12 : st < -6 ? st + 12 : st;
}

function getPreferFlat(fromIdx, toIdx) {
  // Find what concert pitch C maps to in the output, to determine output key
  const st = getSemitones(fromIdx, toIdx);
  const concertCIdx = 0; // C is index 0
  const landingIdx = ((concertCIdx + st) % 12 + 12) % 12;

  // Only use flat spelling for keys that are unambiguously flat
  // (Gb/F# and Cb/B are excluded as they're enharmonically ambiguous)
  const UNAMBIGUOUS_FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db"];
  const landingFlat = FLAT_NOTES[landingIdx];
  if (UNAMBIGUOUS_FLAT_KEYS.includes(landingFlat)) return true;

  // For unambiguous sharp keys, prefer sharps regardless of instrument
  const UNAMBIGUOUS_SHARP_KEYS = ["G", "D", "A", "E", "B"];
  const landingSharp = SHARP_NOTES[landingIdx];
  if (UNAMBIGUOUS_SHARP_KEYS.includes(landingSharp)) return false;

  // Truly ambiguous (C, F#/Gb, Cb/B) — fall back to destination instrument
  return PREFER_FLAT_KEYS.includes(INSTRUMENTS[toIdx].key);
}

function transposeChord(token, semitones, preferFlat) {
  const noteMatch = token.match(NOTE_RE);
  if (!noteMatch) return token;
  const root   = noteMatch[0];
  const suffix = token.slice(root.length);
  const slashIdx = suffix.lastIndexOf('/');
  if (slashIdx >= 0) {
    const beforeSlash = suffix.slice(0, slashIdx);
    const bassNote    = suffix.slice(slashIdx + 1);
    return transposeNote(root, semitones, preferFlat)
      + beforeSlash + '/'
      + transposeNote(bassNote, semitones, preferFlat);
  }
  return transposeNote(root, semitones, preferFlat) + suffix;
}

// ── Validation ────────────────────────────────────────────────────────────
const NOTE_RE = /^[A-G][b#]?/;
const VALID_SUFFIX_RE = /^[0-9A-Za-z#+\-\/()△°ø♭♯Δ]*$/;
const VALID_SUFFIXES = [
  "", "m", "maj", "min", "aug", "dim", "sus", "add",
  "2","4","5","6","7","9","11","13",
  "maj7","maj9","maj11","maj13",
  "m7","m9","m11","m13","m6","m2","m4",
  "dim7","hdim","hdim7","ø7","°7",
  "aug7","+7","7+5","7#5","7b5","7#9","7b9",
  "9sus4","sus2","sus4","7sus4","7sus2",
  "add9","add11","add13","add2","add4",
  "6/9","maj6","6add9",
  "mmaj7","mΔ7","m(maj7)",
  "△","△7","Δ7",
];

function isKnownSuffix(s) {
  if (s === "" || VALID_SUFFIXES.includes(s)) return true;
  for (let i = 1; i < s.length; i++) {
    if (VALID_SUFFIXES.includes(s.slice(0, i)) && isKnownSuffix(s.slice(i))) return true;
  }
  return false;
}

function isValidSuffix(suffix) {
  if (suffix === "") return true;
  const slashIdx = suffix.lastIndexOf('/');
  let core = suffix, bassStr = "";
  if (slashIdx >= 0) {
    bassStr = suffix.slice(slashIdx + 1);
    core    = suffix.slice(0, slashIdx);
    const m = bassStr.match(NOTE_RE);
    if (!m || m[0] !== bassStr) return false;
  }
  return VALID_SUFFIX_RE.test(core) && isKnownSuffix(core);
}

function validateToken(token) {
  const m = token.match(NOTE_RE);
  if (!m) return false;
  return isValidSuffix(token.slice(m[0].length));
}

function tokenPrefersFlat(token) {
  const m = token.match(NOTE_RE);
  if (!m) return false;
  const root = m[0];
  // If the root contains a 'b' (flat), prefer flats; otherwise prefer sharps
  return root.length > 1 && root[1] === 'b';
}

function processText(text, semitones, preferFlat) {
  const invalidTokens = [];
  const output = text.split('\n').map(line =>
    line.split(/(\s+)/).map(part => {
      if (/^\s+$/.test(part) || part === '') return part;
      if (NOTE_RE.test(part)) {
        if (!validateToken(part)) { invalidTokens.push(part); return part; }
        const useFlat = semitones === 0 ? tokenPrefersFlat(part) : (tokenPrefersFlat(part) ? true : preferFlat);
        return semitones === 0 ? part : transposeChord(part, semitones, useFlat);
      }
      invalidTokens.push(part);
      return part;
    }).join('')
  ).join('\n');
  return { output, invalidTokens };
}

// ── UI wiring ─────────────────────────────────────────────────────────────
const fromSel   = document.getElementById('from-select');
const toSel     = document.getElementById('to-select');
const inputArea = document.getElementById('input-area');
const outputArea= document.getElementById('output-area');
const semBadge  = document.getElementById('semitone-display');
const fromTag   = document.getElementById('from-tag');
const toTag     = document.getElementById('to-tag');
const valBox    = document.getElementById('validation-box');
const valList   = document.getElementById('validation-list');

function populateSelect(sel) {
  INSTRUMENTS.forEach((inst, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = inst.label;
    sel.appendChild(opt);
  });
}
populateSelect(fromSel);
populateSelect(toSel);
toSel.value = 1; // default "to" = Trumpet (Bb)

function updateMeta() {
  const st = getSemitones(parseInt(fromSel.value), parseInt(toSel.value));
  semBadge.textContent = st === 0
    ? "0 semitones (no change)"
    : `${st > 0 ? '+' : ''}${st} semitone${Math.abs(st) !== 1 ? 's' : ''}`;
  fromTag.textContent = INSTRUMENTS[fromSel.value].key;
  toTag.textContent   = INSTRUMENTS[toSel.value].key;
}

function clearValidation() {
  valBox.classList.remove('visible');
  outputArea.classList.remove('has-error');
}

fromSel.addEventListener('change', updateMeta);
toSel.addEventListener('change', updateMeta);
updateMeta();

document.getElementById('swap-btn').addEventListener('click', () => {
  [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
  inputArea.value  = outputArea.value;
  outputArea.value = '';
  clearValidation();
  updateMeta();
});

inputArea.addEventListener('input', () => {
  outputArea.value = '';
  clearValidation();
});

document.getElementById('go-btn').addEventListener('click', () => {
  clearValidation();
  const text = inputArea.value.trim();

  if (!text) {
    outputArea.classList.add('has-error');
    valList.innerHTML = '<div class="v-item">No input provided.</div>';
    valBox.classList.add('visible');
    return;
  }

  const fromIdx    = parseInt(fromSel.value);
  const toIdx      = parseInt(toSel.value);
  const st         = getSemitones(fromIdx, toIdx);
  const preferFlat = getPreferFlat(fromIdx, toIdx);
  const { output, invalidTokens } = processText(text, st, preferFlat);

  if (invalidTokens.length > 0) {
    outputArea.value = '';
    outputArea.classList.add('has-error');
    valList.innerHTML = [...new Set(invalidTokens)]
      .map(t => `<div class="v-item">→ "${t}" is not a recognised note or chord</div>`)
      .join('');
    valBox.classList.add('visible');
  } else {
    outputArea.value = output;
  }
});