const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = ['C#', 'D#', 'F#', 'G#', 'A#'];

const state = {
  octave: 4,
  volume: 72,
  currentNote: null,
  audioContext: null,
  isDemoPlaying: false,
  activeKeys: new Set(),
  keyToNoteMap: new Map()
};

const piano = document.getElementById('piano');
const noteDisplay = document.getElementById('note-display');
const octaveLabel = document.getElementById('octave-label');
const volumeInput = document.getElementById('volume');
const demoBtn = document.getElementById('demo-btn');

function getAudioContext() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('Web Audio not supported in this browser.');
      return null;
    }
    state.audioContext = new AudioCtx();
  }
  return state.audioContext;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getNoteLabel(midi) {
  const noteName = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

function createKeyboard() {
  const whiteNotes = [];
  const blackMap = new Map();

  for (let i = 0; i < 14; i += 1) {
    const midi = (state.octave + 1) * 12 + i;
    const noteLabel = getNoteLabel(midi);
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'key white-key';
    key.dataset.note = noteLabel;
    key.dataset.midi = String(midi);
    key.setAttribute('aria-label', noteLabel);
    key.textContent = WHITE_KEYS[i % WHITE_KEYS.length];
    key.addEventListener('pointerdown', () => triggerNote(noteLabel, key));
    key.addEventListener('pointerup', releaseKey);
    key.addEventListener('pointerleave', releaseKey);
    key.addEventListener('contextmenu', (event) => event.preventDefault());
    piano.appendChild(key);
    whiteNotes.push({ noteLabel, key });
  }

  const blackOffsetMap = { C: 0, D: 1, F: 3, G: 4, A: 5 };
  for (let i = 0; i < 14; i += 1) {
    const rawMidi = (state.octave + 1) * 12 + i;
    const noteName = NOTE_NAMES[rawMidi % 12];
    if (!BLACK_KEYS.includes(noteName)) continue;

    const blackKey = document.createElement('button');
    blackKey.type = 'button';
    blackKey.className = 'key black-key';
    blackKey.dataset.note = getNoteLabel(rawMidi);
    blackKey.dataset.midi = String(rawMidi);
    blackKey.setAttribute('aria-label', getNoteLabel(rawMidi));

    const whiteIndex = Math.floor(rawMidi / 12) * 7 + Object.keys(blackOffsetMap).indexOf(noteName);
    const offset = { C: 0, D: 1, F: 3, G: 4, A: 5 }[NOTE_NAMES[rawMidi % 12].replace('#', '')] ?? 0;

    const whiteKeys = Array.from(piano.querySelectorAll('.white-key'));
    const targetWhite = whiteKeys.find((el) => Number(el.dataset.midi) === rawMidi - 1) || whiteKeys[0];

    if (targetWhite) {
      const targetRect = targetWhite.getBoundingClientRect();
      const pianoRect = piano.getBoundingClientRect();
      const blackLeft = targetRect.left - pianoRect.left + 38;
      blackKey.style.left = `${blackLeft}px`;
    }

    blackKey.addEventListener('pointerdown', () => triggerNote(getNoteLabel(rawMidi), blackKey));
    blackKey.addEventListener('pointerup', releaseKey);
    blackKey.addEventListener('pointerleave', releaseKey);
    blackKey.addEventListener('contextmenu', (event) => event.preventDefault());
    piano.appendChild(blackKey);
  }

  Array.from(piano.querySelectorAll('.key')).forEach((key) => {
    state.keyToNoteMap.set(key.dataset.note, key);
  });
}

function updateOctaveLabel() {
  octaveLabel.textContent = `Octave ${state.octave}`;
  piano.innerHTML = '';
  createKeyboard();
}

function triggerNote(noteName, keyElement) {
  const audioContext = getAudioContext();
  const midi = noteNameToMidi(noteName);

  if (midi === null) return;

  state.currentNote = noteName;
  noteDisplay.textContent = noteName;
  keyElement.classList.add('active');
  state.activeKeys.add(noteName);

  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.value = midiToFrequency(midi);

  const now = audioContext.currentTime;
  const level = state.volume / 100;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(level * 0.4, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 1.2);
}

function releaseKey(event) {
  const activeKey = event.currentTarget;
  if (!activeKey) return;
  activeKey.classList.remove('active');
  const note = activeKey.dataset.note;
  if (note) state.activeKeys.delete(note);
  if (state.currentNote && state.activeKeys.size === 0) {
    state.currentNote = null;
    noteDisplay.textContent = '—';
  }
}

function noteNameToMidi(noteName) {
  const note = noteName.replace(/[0-9]/g, '');
  const octave = Number(noteName.match(/[0-9]+$/)?.[0]);
  const noteMap = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const noteValue = noteMap[note];
  if (noteValue === undefined || octave === undefined) return null;
  return (octave + 1) * 12 + noteValue;
}

function playDemo() {
  if (state.isDemoPlaying) return;
  state.isDemoPlaying = true;
  demoBtn.disabled = true;

  const melody = ['C4', 'E4', 'G4', 'C5', 'B4', 'G4', 'E4', 'G4'];
  let index = 0;

  const playNext = () => {
    if (index >= melody.length) {
      state.isDemoPlaying = false;
      demoBtn.disabled = false;
      return;
    }

    const note = melody[index];
    const key = state.keyToNoteMap.get(note);
    if (key) {
      triggerNote(note, key);
      setTimeout(() => {
        key.classList.remove('active');
      }, 220);
    }

    index += 1;
    setTimeout(playNext, 260);
  };

  playNext();
}

function handleKeyDown(event) {
  const keyMap = {
    a: 'C4', s: 'D4', d: 'E4', f: 'F4', g: 'G4', h: 'A4', j: 'B4', k: 'C5', l: 'D5',
    w: 'C#4', e: 'D#4', t: 'F#4', y: 'G#4', u: 'A#4', o: 'C#5', p: 'D#5'
  };

  const note = keyMap[event.key.toLowerCase()];
  if (!note) return;
  if (event.repeat) return;

  const keyElement = state.keyToNoteMap.get(note);
  if (!keyElement) return;
  triggerNote(note, keyElement);
}

function handleKeyUp(event) {
  const keyMap = {
    a: 'C4', s: 'D4', d: 'E4', f: 'F4', g: 'G4', h: 'A4', j: 'B4', k: 'C5', l: 'D5',
    w: 'C#4', e: 'D#4', t: 'F#4', y: 'G#4', u: 'A#4', o: 'C#5', p: 'D#5'
  };

  const note = keyMap[event.key.toLowerCase()];
  if (!note) return;

  const keyElement = state.keyToNoteMap.get(note);
  if (keyElement) keyElement.classList.remove('active');
}

function updateVolume(value) {
  state.volume = Number(value);
}

document.getElementById('octave-down').addEventListener('click', () => {
  state.octave = Math.max(1, state.octave - 1);
  updateOctaveLabel();
});

document.getElementById('octave-up').addEventListener('click', () => {
  state.octave = Math.min(7, state.octave + 1);
  updateOctaveLabel();
});

volumeInput.addEventListener('input', (event) => updateVolume(event.target.value));
demoBtn.addEventListener('click', playDemo);
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

updateOctaveLabel();
