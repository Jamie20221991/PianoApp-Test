// StaffReel: shows the notes you play on a scrolling grand staff (treble + bass clef).
// New notes appear on the right and scroll left, like a tape.
// It also names chords (C maj, A min, G7 ...) in a card beside the staff,
// and can play a whole chord when you click a key.
// This file starts itself (see the bottom), so script.js does not need any changes.

const CLEF_FONT = '"Noto Music", "Segoe UI Symbol", "Apple Symbols", serif';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord shapes: [name, semitones above the root]
const CHORDS = [
  ['maj', [0, 4, 7]], ['min', [0, 3, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]],
  ['sus2', [0, 2, 7]], ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['min7', [0, 3, 7, 10]],
  ['dim7', [0, 3, 6, 9]], ['m7b5', [0, 3, 6, 10]],
  ['6', [0, 4, 7, 9]], ['min6', [0, 3, 7, 9]], ['add9', [0, 2, 4, 7]],
  ['5', [0, 7]]
];

// The same scale shapes as script.js (semitones from the root note)
const SCALES = {
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  'blues': [0, 3, 5, 6, 7, 10],
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'phrygian': [0, 1, 3, 5, 7, 8, 10],
  'lydian': [0, 2, 4, 6, 7, 9, 11],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11]
};

// Flat names for the black keys (used when "Show flats" is ticked)
const FLAT_NAMES = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

// The chord you get by clicking a key: stack thirds on that note, using the chosen scale.
// size is the number of notes (3 = triad, 4 = seventh, 5 = ninth ...).
// Returns semitones above the clicked note, e.g. [0, 4, 7] for a major chord.
function chordFor(pitchClass, scaleName, rootName, size = 3) {
  const pattern = SCALES[scaleName] || SCALES.major;
  const rootPc = Math.max(0, NOTE_NAMES.indexOf(rootName));
  const degree = pattern.indexOf((pitchClass - rootPc + 12) % 12);
  if (degree === -1) return [0, 4, 7, 10, 14, 17].slice(0, size); // outside the scale: dominant-style stack
  const n = pattern.length;
  const above = (steps) => {
    const i = degree + steps;
    return pattern[i % n] + 12 * Math.floor(i / n) - pattern[degree];
  };
  const out = [];
  for (let k = 0; k < size; k++) out.push(k === 0 ? 0 : above(k * 2));
  return out;
}

// Octave-shift marks, like on printed music: notes too high or too low for the staff
// are drawn one or two octaves closer, with a small label.
const SHIFT_MARKS = { '1': '8va', '2': '15ma', '3': '22ma', '-1': '8vb', '-2': '15mb', '-3': '22mb' };

class StaffReel {
  constructor(canvas, readout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.readout = readout || null; // the chord card: { card, label, name, notes }
    this.events = [];        // { t, step, sharp, name, octave, midi }
    this.showNames = true;
    this.useFlats = false;
    this.speed = 160;        // pixels per second
    this.groupWindow = 120;  // ms: notes pressed this close together are drawn as a chord
    this.lastGroupTime = 0;
    this.raf = null;
    this.clefs = [];
    this.clefEnd = 70;
    this.w = 0;
    this.h = 0;
    this.letters = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

    // The staff shows letter steps loStep to hiStep (F1 up to F6), plus a little margin.
    // Anything outside that is drawn with an octave-shift mark.
    this.loStep = 11;
    this.hiStep = 45;
    this.margin = 2;

    this.updateColors();

    if (window.ResizeObserver) {
      new ResizeObserver(() => this.resize()).observe(canvas);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
    this.resize();

    // The clef symbols come from the Noto Music web font: redraw once it has loaded.
    if (document.fonts && document.fonts.load) {
      document.fonts.load('40px "Noto Music"', '\u{1D11E}\u{1D122}')
        .then(() => { this.layoutClefs(); this.draw(); })
        .catch(() => {});
    }
  }

  // ---- public API -------------------------------------------------------

  addNote(note, octave) {
    const now = performance.now();
    let t = now;
    if (now - this.lastGroupTime < this.groupWindow) {
      t = this.lastGroupTime;      // joins the chord that just started
    } else {
      this.lastGroupTime = now;
    }
    const isBlack = note.includes('#');
    const flat = isBlack && this.useFlats;
    const shownName = flat ? FLAT_NAMES[note] : note;
    this.events.push({
      t,
      // Position on the staff, counted in letter steps: C4 (middle C) = 28
      step: octave * 7 + this.letters[shownName[0]],
      sharp: isBlack && !flat,
      flat,
      name: shownName,
      octave,
      midi: (octave + 1) * 12 + NOTE_NAMES.indexOf(note)
    });
    this.updateReadout(t);
    this.start();
  }

  setShowNames(value) {
    this.showNames = value;
    this.draw();
  }

  setUseFlats(value) {
    this.useFlats = value;
  }

  clear() {
    this.events = [];
    this.resetReadout();
    this.draw();
  }

  updateColors() {
    const style = getComputedStyle(document.documentElement);
    this.ink = style.getPropertyValue('--black-key-1').trim() || '#120b08';
  }

  // ---- chord names ------------------------------------------------------

  // Works out a chord from the notes pressed together, or null if it is not a chord
  chordInfo(list) {
    const midis = list.map(e => e.midi);
    const pcs = [...new Set(midis.map(m => m % 12))];
    if (pcs.length < 2) return null;

    const bass = Math.min(...midis) % 12;
    // Try the lowest note as the root first, then the others (that gives inversions like C/E)
    const roots = [bass, ...pcs.filter(p => p !== bass)];
    for (const root of roots) {
      const shape = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
      const match = CHORDS.find(([, set]) =>
        set.length === shape.length && set.every((v, i) => v === shape[i]));
      if (match) return { root, quality: match[0], bass };
    }
    return null;
  }

  // "C maj", "A min", "G7", "C maj / E"
  chordLabel(info) {
    const root = NOTE_NAMES[info.root];
    const text = /^\d/.test(info.quality) ? `${root}${info.quality}` : `${root} ${info.quality}`;
    return info.root === info.bass ? text : `${text} / ${NOTE_NAMES[info.bass]}`;
  }

  // ---- the chord card ---------------------------------------------------

  setReadout(label, name, noteNames) {
    const r = this.readout;
    if (!r) return;
    r.label.textContent = label;
    r.name.textContent = name;
    r.notes.replaceChildren(...noteNames.map((n) => {
      const chip = document.createElement('span');
      chip.textContent = n;
      return chip;
    }));
    // Restart the little pop animation
    r.card.classList.remove('pop');
    void r.card.offsetWidth;
    r.card.classList.add('pop');
  }

  resetReadout() {
    this.setReadout('Play a key', '—', []);
  }

  updateReadout(t) {
    if (!this.readout) return;
    const list = this.events.filter(e => e.t === t).sort((a, b) => a.midi - b.midi);
    if (!list.length) return;

    if (list.length === 1) {
      this.setReadout('Single note', `${list[0].name}${list[0].octave}`, []);
      return;
    }

    const info = this.chordInfo(list);
    const pcs = [...new Set(list.map(e => e.midi % 12))];
    if (info) {
      // Notes listed from the root of the chord upwards: C maj -> C E G
      pcs.sort((a, b) => ((a - info.root + 12) % 12) - ((b - info.root + 12) % 12));
      this.setReadout('Chord', this.chordLabel(info), pcs.map(p => NOTE_NAMES[p]));
    } else {
      const lowToHigh = [];
      list.forEach(e => { if (!lowToHigh.includes(e.name)) lowToHigh.push(e.name); });
      this.setReadout('No chord name', '?', lowToHigh);
    }
  }

  // ---- layout -----------------------------------------------------------

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.w = w;
    this.h = h;
    const steps = (this.hiStep - this.loStep) + this.margin * 2;
    this.half = h / steps;                                  // half a line gap: one letter step
    this.top = (this.hiStep - 38 + this.margin) * this.half; // y of the top treble line
    this.layoutClefs();
    this.draw();
  }

  // y position of a letter step. Treble lines are steps 30-38, bass lines 18-26.
  y(step) {
    return this.top + (38 - step) * this.half;
  }

  // Notes above or below the staff are drawn 1-2 octaves closer, with a mark such as 8va
  displayStep(step) {
    if (step > this.hiStep) {
      const k = Math.ceil((step - this.hiStep) / 7);
      return { step: step - 7 * k, shift: k };
    }
    if (step < this.loStep) {
      const k = Math.ceil((this.loStep - step) / 7);
      return { step: step + 7 * k, shift: -k };
    }
    return { step, shift: 0 };
  }

  // Scales a clef glyph so it covers the given vertical range, whatever the font's metrics.
  fitGlyph(ch, yTop, yBottom) {
    const ctx = this.ctx;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `100px ${CLEF_FONT}`;
    const m = ctx.measureText(ch);
    const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (!height) return null;

    const k = (yBottom - yTop) / height;
    const x = 12 + m.actualBoundingBoxLeft * k;
    return {
      ch,
      size: 100 * k,
      x,
      y: yTop + m.actualBoundingBoxAscent * k,
      right: x + m.actualBoundingBoxRight * k
    };
  }

  layoutClefs() {
    this.clefs = [
      this.fitGlyph('\u{1D11E}', this.y(43), this.y(27)),    // treble clef
      this.fitGlyph('\u{1D122}', this.y(26.3), this.y(19.5)) // bass clef
    ];
    const rights = this.clefs.filter(Boolean).map(c => c.right);
    this.clefEnd = rights.length ? Math.max(...rights) + 16 : 70;
  }

  // ---- animation --------------------------------------------------------

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.tick());
  }

  tick() {
    this.raf = null;
    this.draw();
    if (this.events.length) this.start(); // keeps running only while notes are on screen
  }

  // ---- drawing ----------------------------------------------------------

  draw() {
    const { ctx, w, h } = this;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.ink;
    ctx.strokeStyle = this.ink;
    ctx.globalAlpha = 1;

    this.drawStaff();

    const now = performance.now();
    const entryX = w - 36;
    const gone = this.clefEnd - 10;

    // Drop notes that have scrolled past the clefs
    this.events = this.events.filter(e => entryX - (now - e.t) * this.speed / 1000 > gone);

    // Group by press time so chords share one x position
    const groups = new Map();
    for (const e of this.events) {
      if (!groups.has(e.t)) groups.set(e.t, []);
      groups.get(e.t).push(e);
    }

    groups.forEach((list, t) => {
      const x = entryX - (now - t) * this.speed / 1000;
      const alpha = Math.max(0, Math.min(1, (x - this.clefEnd) / 50));
      const isChord = !!this.chordInfo(list);

      const shown = list.map(e => ({ e, ...this.displayStep(e.step) }));
      shown.sort((a, b) => a.step - b.step);

      // Notes a second apart (or on the same step) would overlap: nudge every other one sideways
      let prevStep = null;
      let prevShifted = false;
      shown.forEach(({ e, step, shift }) => {
        const nudged = prevStep !== null && step - prevStep <= 1 && !prevShifted;
        this.drawNote(e, step, shift, x + (nudged ? this.half * 2.5 : 0), alpha, !isChord);
        prevStep = step;
        prevShifted = nudged;
      });
    });

    ctx.globalAlpha = 1;
  }

  drawStaff() {
    const { ctx, w } = this;
    const left = 8;
    const right = w - 8;

    ctx.lineWidth = 1.6;
    ctx.beginPath();
    [[30, 38], [18, 26]].forEach(([low, high]) => {
      for (let s = low; s <= high; s += 2) {
        const y = Math.round(this.y(s)) + 0.5;
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
    });
    // Barline joining the two staves
    ctx.moveTo(left, this.y(38));
    ctx.lineTo(left, this.y(18));
    ctx.stroke();

    this.clefs.forEach(c => {
      if (!c) return;
      ctx.font = `${c.size}px ${CLEF_FONT}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(c.ch, c.x, c.y);
    });
  }

  drawNote(e, step, shift, x, alpha, showName) {
    const { ctx, half } = this;
    const y = this.y(step);
    const rx = half * 1.3;
    const ry = half * 0.95;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.ink;
    ctx.strokeStyle = this.ink;

    // Ledger lines: middle C, above the treble staff, below the bass staff
    const ledgers = [];
    if (step === 28) ledgers.push(28);
    for (let s = 40; s <= step; s += 2) ledgers.push(s);
    for (let s = 16; s >= step; s -= 2) ledgers.push(s);
    if (ledgers.length) {
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ledgers.forEach(s => {
        const ly = Math.round(this.y(s)) + 0.5;
        ctx.moveTo(x - rx * 1.7, ly);
        ctx.lineTo(x + rx * 1.7, ly);
      });
      ctx.stroke();
    }

    // Note head
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (e.sharp) this.drawSharp(x - rx - half * 1.7, y);
    if (e.flat) this.drawFlat(x - rx - half * 1.5, y);

    // Octave-shift mark (8va, 8vb ...) to the left of the note
    if (shift) {
      ctx.globalAlpha = alpha * 0.85;
      ctx.font = `italic 700 ${Math.max(10, half * 1.9)}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillText(SHIFT_MARKS[String(shift)] || '', x - rx - half * 3.6, y);
      ctx.textAlign = 'left';
    }

    if (this.showNames && showName) {
      ctx.globalAlpha = alpha * 0.7;
      ctx.font = `600 ${Math.max(10, half * 2.3)}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${e.name}${e.octave}`, x + rx + half * 1.2, y);
    }
    ctx.globalAlpha = 1;
  }

  // Sharp sign drawn from lines, so it does not depend on any font (kept small)
  drawSharp(x, y) {
    const { ctx } = this;
    const s = this.half * 0.72;

    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y - s * 2);
    ctx.lineTo(x - s * 0.45, y + s * 2.2);
    ctx.moveTo(x + s * 0.45, y - s * 2.2);
    ctx.lineTo(x + s * 0.45, y + s * 2);
    ctx.stroke();

    ctx.lineWidth = s * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.3);
    ctx.lineTo(x + s, y - s * 1.0);
    ctx.moveTo(x - s, y + s * 1.05);
    ctx.lineTo(x + s, y + s * 0.35);
    ctx.stroke();
  }

  // Flat sign: a stem with a rounded bowl, also drawn from lines
  drawFlat(x, y) {
    const { ctx } = this;
    const s = this.half * 0.72;

    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - s * 3);
    ctx.lineTo(x - s * 0.5, y + s * 1.2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 1.2);
    ctx.bezierCurveTo(x + s * 1.6, y + s * 0.2, x + s * 1.4, y - s * 1.6, x - s * 0.5, y - s * 0.7);
    ctx.stroke();
  }
}

// ---- Start-up: connects the staff to the page and to the piano keys ---------

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('staff');
  const piano = document.getElementById('piano');
  if (!canvas || !piano) return;

  // The chord card beside the staff
  const card = document.getElementById('chord-card');
  const readout = card ? {
    card,
    label: document.getElementById('chord-label'),
    name: document.getElementById('chord-name'),
    notes: document.getElementById('chord-notes')
  } : null;

  const staff = new StaffReel(canvas, readout);

  // "Show note names" checkbox and "Clear" button
  const names = document.getElementById('show-names');
  if (names) {
    names.addEventListener('change', (e) => {
      staff.setShowNames(e.target.checked);
      e.target.blur(); // so the computer-keyboard keys keep working
    });
  }
  const clear = document.getElementById('staff-clear');
  if (clear) {
    clear.addEventListener('click', (e) => {
      staff.clear();
      e.currentTarget.blur();
    });
  }

  // Extra controls, added here so index.html needs no change
  const chordToggle = document.createElement('label');
  chordToggle.className = 'staff-toggle';
  chordToggle.innerHTML = '<input type="checkbox" id="chord-mode" checked /> Click plays a chord';

  const sizes = document.createElement('div');
  sizes.className = 'chord-sizes';
  sizes.innerHTML = 'Bigger chords:' + [4, 5, 6].map((n) =>
    `<label><input type="checkbox" class="chord-size" value="${n}" /> ${n}-note</label>`).join('');

  const flatToggle = document.createElement('label');
  flatToggle.className = 'staff-toggle';
  flatToggle.innerHTML = '<input type="checkbox" id="use-flats" /> Show flats (♭)';

  const header = document.querySelector('.staff-header');
  if (header) {
    header.insertBefore(chordToggle, clear || null);
    header.insertBefore(sizes, clear || null);
    header.insertBefore(flatToggle, clear || null);
  }
  const chordBox = chordToggle.querySelector('input');
  chordBox.addEventListener('change', (e) => e.target.blur());
  sizes.querySelectorAll('input').forEach((box) =>
    box.addEventListener('change', (e) => e.target.blur()));
  flatToggle.querySelector('input').addEventListener('change', (e) => {
    staff.setUseFlats(e.target.checked);
    e.target.blur();
  });

  // The biggest ticked size wins; with nothing ticked, clicks play triads
  const chordSize = () => {
    const ticked = [...sizes.querySelectorAll('input:checked')].map((b) => Number(b.value));
    return ticked.length ? Math.max(...ticked) : 3;
  };

  // Remember when the mouse or a finger last pressed a piano key
  // (computer-keyboard presses never play a chord for you, so you can build your own)
  let lastPointerDown = 0;
  piano.addEventListener('pointerdown', (e) => {
    if (e.isTrusted) lastPointerDown = performance.now();
  }, true);

  // Keys that were pressed for you as part of a chord: root key id -> other keys
  const chordParts = new Map();

  const pressChord = (rootKey) => {
    const keys = Array.from(piano.querySelectorAll('.key')); // lowest note first (A0 at 0), one key per semitone
    const rootIndex = keys.indexOf(rootKey);
    if (rootIndex < 0) return;

    const scale = document.getElementById('scale-select');
    const root = document.getElementById('root-note-select');
    const intervals = chordFor(
      NOTE_NAMES.indexOf(rootKey.dataset.note),
      scale && scale.value,
      root && root.value,
      chordSize()
    );

    const parts = [];
    intervals.slice(1).forEach((semitones) => {
      const key = keys[rootIndex + semitones];
      if (key && key !== rootKey && !parts.includes(key)) parts.push(key);
    });
    chordParts.set(rootKey.dataset.noteId, parts);

    parts.forEach((key, i) => {
      key.dataset.chordPart = '1';
      staff.addNote(key.dataset.note, Number(key.dataset.octave));
      // Press the key exactly as a finger would, so it sounds and lights up
      key.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 1000 + i, pointerType: 'mouse'
      }));
    });
  };

  const releaseChord = (rootNoteId) => {
    const parts = chordParts.get(rootNoteId);
    if (!parts) return;
    chordParts.delete(rootNoteId);
    parts.forEach((key) => {
      delete key.dataset.chordPart;
      key.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, pointerId: 1000, pointerType: 'mouse'
      }));
    });
  };

  // A piano key that gains the "active" class has just been played
  // (mouse, touch, computer keyboard or the demo all do this).
  new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === 'childList') { // the piano was redrawn
        chordParts.clear();
        return;
      }
      const key = r.target;
      if (!key.classList) return;

      const wasActive = (r.oldValue || '').split(/\s+/).includes('active');
      const isActive = key.classList.contains('active');

      if (wasActive && !isActive) {          // key let go: let go of its chord too
        releaseChord(key.dataset.noteId);
        return;
      }
      if (!isActive || wasActive) return;     // not a new press
      if (key.dataset.chordPart) return;      // pressed for a chord: already drawn

      staff.addNote(key.dataset.note, Number(key.dataset.octave));
      if (chordBox.checked && performance.now() - lastPointerDown < 150) pressChord(key);
    });
  }).observe(piano, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true
  });

  // Changing the Finish rewrites the page's colour variables: redraw in the new colours
  new MutationObserver(() => {
    staff.updateColors();
    staff.draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
});
