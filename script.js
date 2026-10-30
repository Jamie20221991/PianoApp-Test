// Theme values are listed once per finish, in the same order as THEME_KEYS.
const THEME_KEYS = [
  'bg-1', 'bg-2', 'bg-3', 'app-shell-top', 'app-shell-mid', 'app-shell-bottom',
  'topbar-top', 'topbar-bottom', 'toolbar-bg-top', 'toolbar-bg-bottom',
  'panel-bg-top', 'panel-bg-bottom', 'piano-top', 'piano-mid', 'piano-bottom',
  'white-key', 'white-key-2', 'white-key-3', 'black-key-1', 'black-key-2', 'black-key-3',
  'gold-soft', 'muted', 'button-grad-1', 'button-grad-2', 'scale-glow'
];

const THEMES = {
  classic: [
    '#1a0f09', '#2d1b12', '#3c2617', 'rgba(111, 71, 49, 0.92)', 'rgba(56, 31, 18, 0.92)', 'rgba(28, 16, 11, 0.96)',
    'rgba(77, 49, 32, 0.9)', 'rgba(46, 27, 17, 0.75)', 'rgba(101, 63, 42, 0.8)', 'rgba(89, 56, 38, 0.72)',
    'rgba(53, 31, 22, 0.9)', 'rgba(29, 17, 12, 0.8)', 'rgba(69,42,27,0.98)', 'rgba(42,27,18,0.96)', 'rgba(21,12,9,0.98)',
    '#fefaf4', '#f4ecdf', '#e8dcc4', '#120b08', '#1f130f', '#2d1d15',
    '#f3d8a6', '#d7b98a', '#ab6d43', '#d49d5d', 'rgba(248, 218, 165, 0.45)'
  ],
  concert: [
    '#0b1015', '#18202a', '#202d3d', 'rgba(18, 24, 32, 0.98)', 'rgba(25, 31, 41, 0.96)', 'rgba(9, 12, 18, 1)',
    'rgba(24, 32, 42, 0.96)', 'rgba(15, 20, 27, 0.9)', 'rgba(37, 46, 58, 0.92)', 'rgba(20, 28, 35, 0.86)',
    'rgba(17, 22, 29, 0.9)', 'rgba(10, 14, 18, 0.92)', 'rgba(16, 18, 22, 0.98)', 'rgba(24, 29, 35, 0.98)', 'rgba(8, 10, 14, 1)',
    '#f7f7f9', '#edf0f5', '#dfe5ed', '#05080d', '#111821', '#1b2430',
    '#dfeaf8', '#b9c8d9', '#5a7ca8', '#93b8d9', 'rgba(140, 200, 255, 0.55)'
  ],
  vintage: [
    '#230d0b', '#3c1b15', '#5a2e22', 'rgba(95, 53, 41, 0.95)', 'rgba(73, 37, 29, 0.94)', 'rgba(42, 19, 15, 0.96)',
    'rgba(84, 45, 36, 0.92)', 'rgba(54, 28, 22, 0.8)', 'rgba(110, 63, 48, 0.78)', 'rgba(83, 48, 39, 0.74)',
    'rgba(68, 39, 31, 0.9)', 'rgba(34, 20, 17, 0.82)', 'rgba(58, 31, 24, 0.98)', 'rgba(42, 24, 18, 0.96)', 'rgba(24, 12, 10, 0.98)',
    '#f9f2e8', '#ecddd0', '#dcc4b3', '#120907', '#1b0f0d', '#2b1715',
    '#f4d5a8', '#d3a07a', '#a75c3e', '#d39b63', 'rgba(255, 185, 100, 0.42)'
  ],
  modern: [
    '#111720', '#1a2430', '#2a3340', 'rgba(31, 39, 48, 0.96)', 'rgba(21, 27, 34, 0.94)', 'rgba(12, 17, 22, 0.98)',
    'rgba(41, 52, 64, 0.96)', 'rgba(25, 34, 41, 0.88)', 'rgba(60, 72, 82, 0.88)', 'rgba(35, 45, 52, 0.82)',
    'rgba(21, 28, 35, 0.9)', 'rgba(12, 17, 21, 0.88)', 'rgba(26, 31, 37, 0.98)', 'rgba(19, 23, 28, 0.96)', 'rgba(8, 11, 15, 1)',
    '#f3f6f9', '#e6edf3', '#d7e0e9', '#090d12', '#141c24', '#202d38',
    '#dfe9f6', '#a9b7c8', '#6d7f90', '#adc3d8', 'rgba(170, 214, 255, 0.5)'
  ]
};

class PianoApp {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // The piano runs from C1 (MIDI 24) up to C7 (MIDI 96): 73 keys, 43 of them white.
    // Middle C has 21 white keys on each side, so it sits exactly in the centre.
    this.firstMidi = 24;
    this.lastMidi = 96;
    this.whiteKeyCount = 43;

    // The computer keyboard plays two octaves at a time:
    // the Z row starts on C of startOctave, the Q row on C one octave higher.
    // With startOctave = 3, the Q key is middle C (C4).
    this.startOctave = 3;
    this.minOctave = 2;
    this.maxOctave = 6;

    this.volume = 0.72;
    this.sustain = 0.4;
    this.reverbAmount = 0.3;
    this.tone = 'piano';
    this.currentScale = 'major';
    this.rootNote = 'C';
    this.pianoStyle = 'classic';
    this.activeNotes = new Map();
    this.demoTimers = [];

    this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    this.blackKeyRatio = 0.6; // black key width as a fraction of a white key

    // key -> [note, octave offset from startOctave]
    this.keyboardMap = {
      z: ['C', 0], s: ['C#', 0], x: ['D', 0], d: ['D#', 0], c: ['E', 0], v: ['F', 0],
      g: ['F#', 0], b: ['G', 0], h: ['G#', 0], n: ['A', 0], j: ['A#', 0], m: ['B', 0],
      q: ['C', 1], '2': ['C#', 1], w: ['D', 1], '3': ['D#', 1], e: ['E', 1], r: ['F', 1],
      '5': ['F#', 1], t: ['G', 1], '6': ['G#', 1], y: ['A', 1], '7': ['A#', 1], u: ['B', 1]
    };

    // Scale definitions (semitones from the root note)
    this.scalePatterns = {
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

    this.initAudio();
    this.init();
  }

  applyTheme() {
    const values = THEMES[this.pianoStyle] || THEMES.classic;
    const root = document.documentElement;
    THEME_KEYS.forEach((key, i) => root.style.setProperty(`--${key}`, values[i]));
  }

  initAudio() {
    const ctx = this.audioContext;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.volume;

    // A compressor keeps chords from clipping.
    this.compressor = ctx.createDynamicsCompressor();
    this.masterGain.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = this.reverbAmount;

    this.convolver = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * 2.5);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    this.convolver.buffer = buffer;
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  init() {
    this.applyTheme();
    this.renderPiano();
    this.setupEventListeners();
    this.centreMiddleC();
    window.addEventListener('resize', () => this.centreMiddleC());
  }

  isNoteInScale(note) {
    const distance = (this.notes.indexOf(note) - this.notes.indexOf(this.rootNote) + 12) % 12;
    return this.scalePatterns[this.currentScale].includes(distance);
  }

  // Updates highlighting on the existing keys, so held notes are not interrupted.
  updateScaleClasses() {
    document.querySelectorAll('.key').forEach(key => {
      const inScale = this.isNoteInScale(key.dataset.note);
      key.classList.toggle('in-scale', inScale);
      key.classList.toggle('out-of-scale', !inScale);
      key.classList.toggle('is-root', key.dataset.note === this.rootNote);
    });
  }

  // Shows which computer key plays which piano key
  updateHints() {
    const hints = {};
    Object.entries(this.keyboardMap).forEach(([letter, [note, offset]]) => {
      hints[`${note}-${this.startOctave + offset}`] = letter.toUpperCase();
    });
    document.querySelectorAll('.key').forEach(key => {
      const hint = key.querySelector('.kbd-hint');
      if (hint) hint.textContent = hints[key.dataset.noteId] || '';
    });
  }

  updateOctaveLabel() {
    document.getElementById('octave-label').textContent =
      `C${this.startOctave}–B${this.startOctave + 1}`;
  }

  // The − and + buttons move the two octaves the computer keyboard plays
  shiftOctave(direction) {
    const start = this.startOctave + direction;
    if (start < this.minOctave || start > this.maxOctave) return;
    this.stopAll();
    this.startOctave = start;
    this.updateHints();
    this.updateOctaveLabel();
  }

  // Only matters on small screens, where the piano scrolls sideways
  centreMiddleC() {
    const piano = document.getElementById('piano');
    const c4 = piano.querySelector('[data-note-id="C-4"]');
    if (!c4 || piano.scrollWidth <= piano.clientWidth) return;
    const pianoBox = piano.getBoundingClientRect();
    const keyBox = c4.getBoundingClientRect();
    piano.scrollLeft += (keyBox.left + keyBox.width / 2) - (pianoBox.left + pianoBox.width / 2);
  }

  renderPiano() {
    this.stopAll();

    const piano = document.getElementById('piano');
    piano.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'keys';

    let whitesSoFar = 0; // a black key sits on the line after this many white keys

    for (let midi = this.firstMidi; midi <= this.lastMidi; midi++) {
      const note = this.notes[midi % 12];
      const octave = Math.floor(midi / 12) - 1;
      const isBlack = note.includes('#');
      const noteId = `${note}-${octave}`;
      const key = document.createElement('button');

      key.type = 'button';
      key.className = `key ${isBlack ? 'black-key' : 'white-key'}`;
      key.dataset.note = note;
      key.dataset.octave = octave;
      key.dataset.noteId = noteId;
      key.setAttribute('aria-label', `${note} ${octave}`);
      if (midi === 60) key.classList.add('middle-c');

      if (isBlack) {
        const width = this.blackKeyRatio;
        key.style.left = `${((whitesSoFar - width / 2) / this.whiteKeyCount) * 100}%`;
        key.style.width = `${(width / this.whiteKeyCount) * 100}%`;
      } else {
        // White keys show the note name (every C also shows its octave)
        const nameLabel = document.createElement('span');
        nameLabel.className = 'note-name';
        nameLabel.textContent = note === 'C' ? `C${octave}` : note;
        key.appendChild(nameLabel);
        whitesSoFar++;
      }

      // The computer-keyboard letter (filled in by updateHints)
      const hintLabel = document.createElement('span');
      hintLabel.className = 'kbd-hint';
      key.appendChild(hintLabel);

      // Pointer events cover mouse, touch and pen.
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (key.hasPointerCapture && key.hasPointerCapture(e.pointerId)) {
          key.releasePointerCapture(e.pointerId); // lets you slide across keys
        }
        this.playNote(note, octave, key);
      });
      key.addEventListener('pointerenter', (e) => {
        if (e.buttons === 1) this.playNote(note, octave, key);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
        key.addEventListener(type, () => this.stopNote(noteId, key));
      });

      wrap.appendChild(key);
    }

    piano.appendChild(wrap);
    this.updateScaleClasses();
    this.updateHints();
    this.updateOctaveLabel();
  }

  getToneSettings() {
    if (this.tone === 'bright') {
      return { attack: 0.006, decay: 0.18, release: 1.2 + this.sustain * 2.6, harmonicMix: 0.82, filterCutoff: 5200 };
    }
    if (this.tone === 'warm') {
      return { attack: 0.01, decay: 0.24, release: 1.6 + this.sustain * 3.2, harmonicMix: 0.46, filterCutoff: 3000 };
    }
    return { attack: 0.008, decay: 0.15, release: 1.3 + this.sustain * 3, harmonicMix: 0.68, filterCutoff: 3600 };
  }

  playNote(note, octave, keyElement) {
    const noteId = `${note}-${octave}`;
    if (this.activeNotes.has(noteId)) return;

    const ctx = this.audioContext;
    if (ctx.state === 'suspended') ctx.resume(); // required by iOS/Safari and some browsers

    const settings = this.getToneSettings();
    const freq = this.getFrequency(note, octave);
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = settings.filterCutoff;
    filter.Q.value = 0.7;

    const voiceGain = ctx.createGain(); // used for the release
    filter.connect(voiceGain);
    voiceGain.connect(this.convolver);
    voiceGain.connect(this.masterGain);

    // [frequency, wave, detune, level]
    const partials = [
      [freq, 'sine', 0, 1],
      [freq * 2, 'triangle', 4, settings.harmonicMix],
      [freq * 3, 'sine', -2, 0.42]
    ];

    const oscillators = partials.map(([f, type, detune, level]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const peak = 0.28 * level;

      osc.type = type;
      osc.frequency.value = f;
      osc.detune.value = detune;

      // Attack, then a slow decay while the key is held (more piano-like).
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + settings.attack);
      gain.gain.exponentialRampToValueAtTime(peak * 0.45, now + settings.attack + settings.decay + 1.2);

      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      return osc;
    });

    this.activeNotes.set(noteId, { oscillators, voiceGain, filter, release: settings.release });

    if (keyElement) keyElement.classList.add('active');
  }

  stopNote(noteId, keyElement) {
    const voice = this.activeNotes.get(noteId);
    if (!voice) return;

    const now = this.audioContext.currentTime;
    const gain = voice.voiceGain.gain;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
    gain.exponentialRampToValueAtTime(0.0001, now + voice.release);

    voice.oscillators.forEach(osc => osc.stop(now + voice.release + 0.1));
    voice.oscillators[0].onended = () => {
      voice.filter.disconnect();
      voice.voiceGain.disconnect();
    };

    this.activeNotes.delete(noteId);
    if (keyElement) keyElement.classList.remove('active');
  }

  stopAll() {
    this.demoTimers.forEach(clearTimeout);
    this.demoTimers = [];
    [...this.activeNotes.keys()].forEach(noteId => {
      this.stopNote(noteId, document.querySelector(`[data-note-id="${noteId}"]`));
    });
  }

  getFrequency(note, octave) {
    // Equal temperament, A4 = 440 Hz
    const midi = (octave + 1) * 12 + this.notes.indexOf(note);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  setupEventListeners() {
    const on = (id, event, handler) => {
      document.getElementById(id).addEventListener(event, (e) => {
        handler(e);
        // Release focus so the computer-keyboard keys keep working.
        if (event === 'change') e.target.blur();
      });
    };

    on('octave-down', 'click', () => this.shiftOctave(-1));
    on('octave-up', 'click', () => this.shiftOctave(1));

    on('scale-select', 'change', (e) => {
      this.currentScale = e.target.value;
      this.updateScaleClasses();
    });
    on('root-note-select', 'change', (e) => {
      this.rootNote = e.target.value;
      this.updateScaleClasses();
    });
    on('style-select', 'change', (e) => {
      this.pianoStyle = e.target.value;
      this.applyTheme();
    });
    on('volume', 'input', (e) => {
      this.volume = e.target.value / 100;
      this.masterGain.gain.value = this.volume;
    });
    on('sustain', 'input', (e) => { this.sustain = e.target.value / 100; });
    on('reverb', 'input', (e) => {
      this.reverbAmount = e.target.value / 100;
      this.reverbGain.gain.value = this.reverbAmount;
    });
    on('tone', 'change', (e) => { this.tone = e.target.value; });
    on('demo-btn', 'click', () => this.playDemo());

    const lookup = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return null;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return null;
      const mapped = this.keyboardMap[e.key.toLowerCase()];
      if (!mapped) return null;
      const [note, offset] = mapped;
      const octave = this.startOctave + offset;
      const keyElement = document.querySelector(`[data-note-id="${note}-${octave}"]`);
      return keyElement ? { note, octave, keyElement } : null;
    };

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const hit = lookup(e);
      if (hit) this.playNote(hit.note, hit.octave, hit.keyElement);
    });

    document.addEventListener('keyup', (e) => {
      const hit = lookup(e);
      if (hit) this.stopNote(`${hit.note}-${hit.octave}`, hit.keyElement);
    });

    window.addEventListener('blur', () => this.stopAll());
  }

  // Plays the selected scale upwards from the root note, starting near middle C.
  playDemo() {
    this.stopAll();

    const demoOctave = 4;
    const rootIndex = this.notes.indexOf(this.rootNote);
    const semitones = [...this.scalePatterns[this.currentScale], 12].map(s => rootIndex + s);
    const sequence = semitones.map(s => ({
      note: this.notes[s % 12],
      octave: demoOctave + Math.floor(s / 12)
    }));

    sequence.forEach(({ note, octave }, i) => {
      const noteId = `${note}-${octave}`;
      this.demoTimers.push(setTimeout(() => {
        const keyElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (!keyElement) return;
        this.playNote(note, octave, keyElement);
        this.demoTimers.push(setTimeout(() => this.stopNote(noteId, keyElement), 280 + this.sustain * 400));
      }, i * 360));
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.pianoApp = new PianoApp();
});
