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
  return partition.replace(/\s/g, "").split(/(?!\(.*),(?![^(]*?\))/g).map(chord => {
   return {
      duration: getChordDuration(chord),
      frequencies: chord.replace(/.*\(|\).*/g, "").split(",").map(note => getNoteFrequency(note)),
      name: chord,
    }
  })
}

const totalDuration = chords => chords.reduce((acc, chord) => acc + chord.duration, 0);

const play = async partition => {
  const chords = parsePartition(partition);
  const duration = totalDuration(chords);

  const offlineContext = new OfflineAudioContext(1, audioContext.sampleRate * duration, audioContext.sampleRate);

  const gainNode = offlineContext.createGain();
  gainNode.connect(offlineContext.destination);

  await enqueueChords(chords, offlineContext, gainNode);

  const renderedBuffer = await offlineContext.startRendering();

  const source = audioContext.createBufferSource();
  source.buffer = renderedBuffer;
  source.loop = true;

  source.connect(audioContext.destination);

  return source;
}

const enqueueChords = async (chords, context, gainNode) => {
  let startTime = 0;

  const chordsPromises = chords.map(chord => {
    const { frequencies, duration } = chord;
    endTime = startTime + duration;
    const splittedGain = 1 / frequencies.length;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(splittedGain, startTime + 0.005);
    gainNode.gain.linearRampToValueAtTime(0, endTime - 0.005);

    const oscillatorPromises = frequencies.map(frequency => {
      return new Promise(resolve => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.connect(gainNode);
        oscillator.start(startTime);
        oscillator.stop(endTime);

        resolve();
      });
    });

    startTime += chord.duration;

    return Promise.all(oscillatorPromises);
  });

  await Promise.all(chordsPromises);
}

const partition = "F6,E6,G6,B6,D#6,(D,F#,A),(D,F#,A),(A,C#,E),(A,C#,E),(B,D,F#),(B,D,F#),(G,B,D),(G,B,D),(D,F#,A),(D,F#,A),(G,B,D),(G,B,D),(A,C#,E),(A,C#,E),(D,F#,A),(D,F#,A)";

let song = null;

start = async () => { song = song || await play(partition); song.start() };
pause = () => audioContext.suspend();
resume = () => audioContext.resume();
stop = () => { song.stop(); song = null; };
