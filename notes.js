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
];

const audioContext = new AudioContext();
const pauseBeforeStart = 0.5;
const tempo = 120;

const zbeep = async (chord, prevTime = 0) => {
  const time = prevTime;
  const duration = chord.duration;
  const splittedGain = 1 / chord.frequencies.length;

  const oscillatorPromises = chord.frequencies.map(frequency => {
    return new Promise(resolve => {
      const oscillator = audioContext.createOscillator();

      const gainNode = audioContext.createGain();

      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(splittedGain, time + 0.005);

      oscillator.connect(gainNode);

      gainNode.connect(audioContext.destination);

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, time);

      oscillator.start(time);

      endTime = time + duration;

      gainNode.gain.linearRampToValueAtTime(0, endTime - 0.005);

      oscillator.stop(endTime);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();

        resolve();
      };
    });
  });

  await Promise.all(oscillatorPromises);

  return time + duration;
};

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

  const { frequency } = notes.find(({ name }) => name === note);

  return frequency * (2 ** exposure);
};

const playChords = async chords => {
  let prevTime = 0;

  for (const chord of chords) {

    if (chord.toString().startsWith("-")) {
      prevTime += duration;
      continue;
    }

    prevTime = await zbeep(chord, prevTime);
  }
};

const parsePartition = partition => {
  return partition.replace(/\s/g, "").split(/(?!\(.*),(?![^(]*?\))/g).map(chord => {
   return {
      duration: getChordDuration(chord),
      frequencies: chord.replace(/.*\(|\).*/g, "").split(",").map(note => getNoteFrequency(note))
    }
  })
}

const partition = "E6/2,(E, G#, B)/3,(E, G#, B)/3,(E, G#, B)/3,(F, A,C),(E, G#, B)*2,(G,B,D)/8,(G,B,D)/8,(G,B,D)/8,(G,B,D)/8,(G,B,D)/8"

await playChords(parsePartition(partition));
