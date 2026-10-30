// Artist panel: pick an artist (Chopin first) to get buttons for the scales, chords and
// melodies they used. More artists can be added to ARTISTS later.
// Notes use sharps (A#4 = B-flat 4) because that is how the piano keys are named.

const ARTISTS = {
  chopin: {
    name: 'Chopin',
    blurb: 'Romantic piano music: lots of flat keys, minor colours and rich chords.',
    scales: [
      { label: 'E♭ major', root: 'D#', scale: 'major' },
      { label: 'A♭ major', root: 'G#', scale: 'major' },
      { label: 'D♭ major', root: 'C#', scale: 'major' },
      { label: 'C♯ harmonic minor', root: 'C#', scale: 'harmonic-minor' },
      { label: 'F minor', root: 'F', scale: 'minor' },
      { label: 'B♭ minor', root: 'A#', scale: 'minor' },
      { label: 'E minor', root: 'E', scale: 'minor' },
      { label: 'A minor (melodic)', root: 'A', scale: 'melodic-minor' }
    ],
    // root is the pitch class; the chord is built from the root up in octave 3
    chords: [
      { label: 'E♭ maj', root: 'D#', intervals: [0, 4, 7] },
      { label: 'B♭7', root: 'A#', intervals: [0, 4, 7, 10] },
      { label: 'C min7', root: 'C', intervals: [0, 3, 7, 10] },
      { label: 'A♭ maj7', root: 'G#', intervals: [0, 4, 7, 11] },
      { label: 'F min', root: 'F', intervals: [0, 3, 7] },
      { label: 'C♯ dim7', root: 'C#', intervals: [0, 3, 6, 9] },
      { label: 'D♭ maj (Neapolitan)', root: 'C#', intervals: [0, 4, 7] }
    ],
    // [note, beats]. Simplified sketches of the openings, not note-exact scores.
    melodies: [
      {
        label: 'Nocturne Op. 9 No. 2',
        notes: [['A#4', 1.5], ['G5', 0.5], ['A#4', 0.5], ['D#5', 1.5], ['C5', 0.5], ['A#4', 2]]
      },
      {
        label: 'Prelude Op. 28 No. 4',
        notes: [['B4', 2], ['B4', 1], ['C5', 1], ['B4', 2], ['A4', 1], ['A4', 1], ['G4', 2]]
      },
      {
        label: 'Raindrop Prelude Op. 28 No. 15',
        notes: [['G#4', 1], ['G#4', 1], ['G#4', 1], ['G#4', 1], ['A#4', 1.5], ['G#4', 0.5], ['F4', 2]]
      }
    ]
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('artist-select');
  if (!select) return;

  const app = () => window.pianoApp;
  const keyFor = (note, octave) => document.querySelector(`[data-note-id="${note}-${octave}"]`);

  const split = (id) => {
    const m = /^([A-G]#?)(\d)$/.exec(id);
    return { note: m[1], octave: Number(m[2]) };
  };

  const setSelect = (id, value) => {
    const el = document.getElementById(id);
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Plays notes (as { note, octave }) at the same time, then lets go
  const playTogether = (list, ms) => {
    const a = app();
    a.stopAll();
    list.forEach(({ note, octave }) => {
      const el = keyFor(note, octave);
      if (el) a.playNote(note, octave, el);
    });
    a.demoTimers.push(setTimeout(() => {
      list.forEach(({ note, octave }) => a.stopNote(`${note}-${octave}`, keyFor(note, octave)));
    }, ms));
  };

  const playChord = (chord) => {
    const base = 36 + app().notes.indexOf(chord.root); // octave 3
    playTogether(chord.intervals.map((i) => {
      const midi = base + i;
      return { note: app().notes[midi % 12], octave: Math.floor(midi / 12) - 1 };
    }), 1400);
  };

  const playMelody = (melody) => {
    const a = app();
    a.stopAll();
    const beat = 600;
    let at = 0;
    melody.notes.forEach(([id, beats]) => {
      const { note, octave } = split(id);
      const start = at;
      a.demoTimers.push(setTimeout(() => {
        const el = keyFor(note, octave);
        if (!el) return;
        a.playNote(note, octave, el);
        a.demoTimers.push(setTimeout(() => a.stopNote(id, el), beats * beat * 0.92));
      }, start));
      at += beats * beat;
    });
  };

  const panel = document.createElement('section');
  panel.className = 'artist-panel';
  panel.hidden = true;
  document.body.appendChild(panel);

  const cols = document.createElement('div');
  cols.className = 'artist-cols';

  const section = (title, items, onClick) => {
    const col = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = title;
    const list = document.createElement('div');
    list.className = 'artist-list';
    items.forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.label;
      b.addEventListener('click', (e) => { onClick(item); e.currentTarget.blur(); });
      list.appendChild(b);
    });
    col.append(h, list);
    cols.appendChild(col);
  };

  // On wide screens, sit over the staff itself so the tick boxes above it stay usable
  const place = () => {
    const body = document.querySelector('.staff-body');
    if (!body || panel.hidden || window.innerWidth <= 900) {
      panel.style.cssText = '';
      return;
    }
    const r = body.getBoundingClientRect();
    panel.style.top = `${r.top}px`;
    panel.style.left = `${r.left}px`;
    panel.style.width = `${r.width}px`;
    panel.style.maxHeight = `${r.height}px`;
  };
  window.addEventListener('resize', place);

  const render = (artist) => {
    panel.replaceChildren();
    cols.replaceChildren();
    const head = document.createElement('div');
    head.className = 'artist-head';
    head.innerHTML = `<h2>${artist.name}</h2>`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'artist-close';
    close.setAttribute('aria-label', 'Close artist panel');
    close.textContent = '✕';
    close.addEventListener('click', () => { panel.hidden = true; });
    head.appendChild(close);

    const blurb = document.createElement('p');
    blurb.className = 'artist-blurb';
    blurb.textContent = artist.blurb;
    panel.append(head, blurb);

    section('Scales (sets scale + root)', artist.scales, (s) => {
      setSelect('scale-select', s.scale);
      setSelect('root-note-select', s.root);
    });
    section('Chords (click to hear)', artist.chords, playChord);
    section('Melodies (click to play)', artist.melodies, playMelody);
    panel.appendChild(cols);

    const note = document.createElement('p');
    note.className = 'artist-note';
    note.textContent = 'Melodies are simplified sketches of the opening phrases.';
    panel.appendChild(note);
  };

  select.addEventListener('change', (e) => {
    const artist = ARTISTS[e.target.value];
    if (artist) {
      render(artist);
      panel.hidden = false;
    } else {
      panel.hidden = true;
    }
    place();
    e.target.blur();
  });
});
