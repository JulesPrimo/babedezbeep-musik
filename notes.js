const notes = () => {
  return [
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
}

const audioContext = new AudioContext();
const pauseBeforeStart = 0.5;
const tempo = 120;

const getChordDuration = chord => {
  const seconds = 60 / tempo;
  const { operator, number } = /.+?(?<operator>\/|\*)?(?<number>\d)?$/.exec(chord).groups;

  if (operator === "/") { return seconds / number; }
  if (operator === "*") { return seconds * number; }

  return seconds;
};

const getNoteFrequency = name => {
  const { note, scale } = /(?<note>[A-Z]#?|-)?(?<scale>\d*)/.exec(name).groups;

  const exposure = scale === "" ? 0 : parseInt(scale) - 4;

  const { frequency } = notes().find(({ name }) => name === note);

  return frequency * (2 ** exposure);
};

const parsePartition = partition => {
  const chords = partition.replace(/\s/g, "").split(/(?!\(.*),(?![^(]*?\))/g);

  return chords.map(chord => {
    return {
      duration: getChordDuration(chord),
      frequencies: getSlideOrigAndDest(chord),
      name: chord,
    }
  })
}

const getSlideOrigAndDest = chord => {
  const origAndDest = {}

  const slide = chord.split("->");

  origAndDest.origin = getChordFrequencies(slide[0]);

  origAndDest.destination = slide[1] ? getChordFrequencies(slide[1]) : origAndDest.origin;

  return origAndDest;
}

const getChordFrequencies = chord => {
  return chord.replace(/.*\(|\).*/g, "").split(",").map(note => {
    return getNoteFrequency(note);
  })
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
    const gainValue = 1 / frequencies.origin.length;

    frequencies.origin.forEach((frequency, i) => {
      createOscillatorForFrequency(context, frequency, startTime, endTime, gainValue, frequencies.destination[i]);
    });

    startTime += duration;
  });
}

const createGainForFrequency = (context, startTime, endTime, gainValue) => {
  const gainNode = context.createGain();

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gainValue, startTime + 0.005);
  gainNode.gain.linearRampToValueAtTime(0, endTime - 0.005);
  gainNode.connect(context.destination);

  return gainNode;
}

const createOscillatorForFrequency = (context, frequency, startTime, endTime, gainValue, destination) => {
  const oscillator = context.createOscillator();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.linearRampToValueAtTime(destination, endTime);
  oscillator.start(startTime);
  oscillator.stop(endTime);
  oscillator.connect(
    createGainForFrequency(context, startTime, endTime, gainValue)
  );

  return oscillator;
}

const partition = "(A,B,C)->(B,D,E)*2, (A,B,C), F->A, A->G, G->D, (E,G,B)->(A,F,E)/3, (E,G,B)->(A,F,E)/3, (E,G,B)->(A,F,E)/3, (E,G,B)->(A,F,E)/3";

let song = null;

start = async () => { song = song || await play(partition); song.start(); return song; };
pause = () => audioContext.suspend();
resume = () => audioContext.resume();
stop = () => { song.stop(); song = null; };

start();