const getNote = (note) => {
  const notes = [
    { name: "C", frequency: 261.63 },
    { name: "C#", frequency: 277.18 },
    { name: "D", frequency: 293.66 },
    { name: "D#", frequency: 311.13 },
    { name: "E", frequency: 329.63 },
    { name: "F", frequency: 349.23 },
    { name: "F#", frequency: 369.99 },
    { name: "G", frequency: 392.00 },
    { name: "G#", frequency: 415.30 },
    { name: "A", frequency: 440.00 },
    { name: "A#", frequency: 466.16 },
    { name: "B", frequency: 493.88 },
    { name: "-", frequency: 0 },
  ];

  const scale = ["C", "D", "E", "F", "G", "A", "B"]

  note = note.toUpperCase();

  const [noteName, signature] = note.split('');

  if (signature === "B") {
    if (noteName === "C") { return { name: "B", frequency:  493.88 / 2 }; }

    note = [scale[scale.lastIndexOf(noteName) - 1], noteName === "F" ? "" : "#"].join("");
  }

  if (signature === "#") {
    if (noteName === "B") { return { name: "C", frequency:  261.63 * 2 }; }
    if (noteName === "E") { note = "F"; }
  }

  return notes.find(({ name }) => name === note)
}

const audioContext = new AudioContext();
const pauseBeforeStart = 0.5;
const tempo = 240;

const getChordDuration = chord => {
  const seconds = 60 / tempo;
  const { operator, number } = /.+?(?<operator>\/|\*)?(?<number>\d)?$/.exec(chord).groups;

  if (operator === "/") { return seconds / number; }
  if (operator === "*") { return seconds * number; }

  return seconds;
};

const getNoteFrequency = name => {
  const { note, scale } = /(?<note>[A-Z](#|b)?|-)?(?<scale>\d*)/.exec(name).groups;

  const exposure = scale === "" ? 0 : parseInt(scale) - 4;

  const { frequency } = getNote(name);

  return frequency * (2 ** exposure);
};

const parsePartition = partition => {
  const chords = partition.replace(/\s/g, "").split(/(?!\(.*),(?![^(]*?\))/g);

  return chords.map(chord => {
    return {
      duration: getChordDuration(chord),
      frequencies: getRampFrequencies(chord),
      name: chord,
    }
  })
}

const getRampFrequencies = chord => {
  const ramp = chord.split("->");
  const steps = ramp.map(step => getChordFrequencies(step));

  return steps[0].map((step, i) => {
    const rampFrequency = [step]

    for(let j = 1; j < steps.length; j++) {
      rampFrequency.push(steps[j][i]);
    }

    return rampFrequency;
  });
}

const getChordFrequencies = chord => {
  return chord.replace(/.*\(|\).*/g, "").split(",").map(note => {
    return getNoteFrequency(note);
  });
}

const totalDuration = chords => chords.reduce((acc, chord) => acc + chord.duration, 0);

const play = async partition => {
  const chords = parsePartition(partition);
  const duration = totalDuration(chords);

  const offlineContext = new OfflineAudioContext(1, audioContext.sampleRate * duration, audioContext.sampleRate);

  enqueueChords(chords, offlineContext);

  const renderedBuffer = await offlineContext.startRendering();

  const source = audioContext.createBufferSource();
  source.buffer = renderedBuffer;
  source.loop = true;

  source.connect(audioContext.destination);

  return source;
}

const enqueueChords = (chords, context) => {
  let startTime = 0;

  chords.forEach(({ frequencies, duration })  => {
    endTime = startTime + duration;

    const gainValue = 1 / frequencies.length;

    frequencies.forEach((frequency) => {
      createOscillatorForFrequency(context, frequency, startTime, endTime, gainValue);
    });

    startTime += duration;
  });
}

const createGainNode = (context, startTime, endTime, gainValue) => {
  const gainNode = context.createGain();

  console.log(gainValue)
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gainValue, startTime + 0.005);
  gainNode.gain.linearRampToValueAtTime(0, endTime - 0.005);
  gainNode.connect(context.destination);

  return gainNode;
}

const createOscillatorForFrequency = (context, frequency, startTime, endTime, gainValue) => {
  const oscillator = context.createOscillator();

  oscillator.type = "sine";

  oscillator.frequency.setValueAtTime(frequency[0], startTime);

  const rampTime = (endTime - startTime) / frequency.length;

  for(let i = 1; i < frequency.length; i++) {
    oscillator.frequency.linearRampToValueAtTime(frequency[i], startTime + i * rampTime);
  }

  oscillator.start(startTime);
  oscillator.stop(endTime);
  oscillator.connect(
    createGainNode(context, startTime, endTime, gainValue)
  );

  return oscillator;
}

const partition = "((a,b)->(a,d))*9";

let song = null;

start = async () => { song = song || await play(partition); song.start(); return song; };
pause = () => audioContext.suspend();
resume = () => audioContext.resume();
stop = () => { song.stop(); song = null; };
play(partition);
start();