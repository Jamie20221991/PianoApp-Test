// StaffReel: shows the notes you play on a scrolling grand staff (treble + bass clef).
// New notes appear on the right and scroll left, like a tape.
// It also names chords (Cmaj, Amin, G7 ...) and can play a whole chord when you click a key.
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
  'mixolydian': [0, 2, 4, 5, 7, 9, 10]
};

// The chord you get by clicking a key: stack two thirds on that note, using the chosen scale.
// Returns semitones above the clicked note, e.g. [0, 4, 7] for a major chord.
function triadFor(pitchClass, scaleName, rootName) {
  const pattern = SCALES[scaleName] || SCALES.major;
  const rootPc = Math.max(0, NOTE_NAMES.indexOf(rootName));
  const degree = pattern.indexOf((pitchClass - rootPc + 12) % 12);
  if (degree === -1) return [0, 4, 7]; // note outside the scale: plain major chord
  const n = pattern.length;
  const above = (steps) => (pattern[(degree + steps) % n] - pattern[degree] + 12) % 12;
  return [0, above(2), above(4)];
}

class StaffReel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.events = [];        // { t, step, sharp, name, octave, midi }
    this.showNames = true;
    this.speed = 160;        // pixels per second
    this.groupWindow = 120;  // ms: notes pressed this close together are drawn as a chord
    this.lastGroupTime = 0;
    this.raf = null;
    this.clefs = [];
    this.clefEnd = 70;
    this.w = 0;
    this.h = 0;
    this.letters = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

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
    this.events.push({
      t,
      // Position on the staff, counted in letter steps: C4 (middle C) = 28
      step: octave * 7 + this.letters[note[0]],
      sharp: note.includes('#'),
      name: note,
      octave,
      midi: (octave + 1) * 12 + NOTE_NAMES.indexOf(note)
    });
    this.start();
  }

  setShowNames(value) {
    this.showNames = value;
    this.draw();
  }

  clear() {
    this.events = [];
    this.draw();
  }

  updateColors() {
    const style = getComputedStyle(document.documentElement);
    this.ink = style.getPropertyValue('--black-key-1').trim() || '#120b08';
    this.accent = style.getPropertyValue('--button-grad-1').trim() || '#ab6d43';
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
    // The canvas holds every note of an 88-key piano, from A0 (step 5) up to C8 (step 56).
    this.half = h / 56;          // half a line gap: the distance of one letter step
    this.top = this.half * 21.5; // y of the top treble line
    this.layoutClefs();
    this.draw();
  }

  // y position of a letter step. Treble lines are steps 30-38, bass lines 18-26.
  y(step) {
    return this.top + (38 - step) * this.half;
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
      list.sort((a, b) => a.step - b.step);

      // Notes a second apart (or on the same step) would overlap: nudge every other one sideways
      let prevStep = null;
      let prevShifted = false;
      list.forEach(e => {
        const shifted = prevStep !== null && e.step - prevStep <= 1 && !prevShifted;
        this.drawNote(e, x + (shifted ? this.half * 2.5 : 0), alpha, !this.chordName(list));
        prevStep = e.step;
        prevShifted = shifted;
      });

      // Chord name (Cmaj, Amin, G7 ...) above the highest note
      const label = this.chordName(list);
      if (label) {
        const highest = Math.min(...list.map(e => this.y(e.step)));
        this.drawChordLabel(label, x, highest, alpha);
      }
    });

    ctx.globalAlpha = 1;
  }

  drawStaff() {
    const { ctx, w } = this;
    const left = 8;
    const right = w - 8;

    ctx.lineWidth = 1.2;
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

  drawNote(e, x, alpha, showName) {
    const { ctx, half } = this;
    const y = this.y(e.step);
    const rx = half * 1.3;
    const ry = half * 0.95;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.ink;
    ctx.strokeStyle = this.ink;

    // Ledger lines: middle C, above the treble staff, below the bass staff
    const ledgers = [];
    if (e.step === 28) ledgers.push(28);
    for (let s = 40; s <= e.step; s += 2) ledgers.push(s);
    for (let s = 16; s >= e.step; s -= 2) ledgers.push(s);
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

    if (e.sharp) this.drawSharp(x - rx - half * 2.2, y);

    if (this.showNames && showName) {
      ctx.globalAlpha = alpha * 0.7;
      ctx.font = `600 ${Math.max(10, half * 2.3)}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${e.name}${e.octave}`, x + rx + half * 1.2, y);
    }
    ctx.globalAlpha = 1;
  }

  // Works out a chord name from the notes pressed together, or null if it is not a chord
  chordName(list) {
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
      if (match) {
        const slash = root !== bass ? `/${NOTE_NAMES[bass]}` : '';
        return `${NOTE_NAMES[root]}${match[0]}${slash}`;
      }
    }
    return null;
  }

  drawChordLabel(text, x, topY, alpha) {
    const { ctx, half } = this;
    const size = Math.max(13, half *
