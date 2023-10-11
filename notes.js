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

const audioContext = new AudioContext();
const pauseBeforeStart = 0.5;
const tempo = 120;

const zbeep = async (chord, startTime = 0) => {
  const endTime = startTime +  chord.duration;
  const splittedGain = 1 / chord.frequencies.length;
  const gainNode = audioContext.createGain();

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(splittedGain, startTime + 0.005);
  gainNode.gain.linearRampToValueAtTime(0, endTime - 0.005);

  const oscillatorPromises = chord.frequencies.map(frequency => {
    return new Promise(resolve => {
      let oscillator = audioContext.createOscillator();

      oscillator.connect(gainNode);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.start(startTime);
      oscillator.stop(endTime);

      oscillator.onended = () => {
        oscillator.disconnect();
        oscillator = null;

        resolve();
      };
    });
  });

  gainNode.connect(audioContext.destination);

  await Promise.all(oscillatorPromises);

  gainNode.disconnect();

  return endTime;
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

const playChords = async (chords, prevTime = 0) => {
  for (const chord of chords) {
    console.log(chord.name)

    if (chord.name.startsWith("-")) {
      prevTime += chord.duration;
      continue;
    }

    prevTime = await zbeep(chord, prevTime);
  }

  return prevTime;
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

//const partition = "E6/2,(E, G#, B)/3,(E, G#, B)/3,(E, G#, B)/3,(F, A,C),(E, G#, B)*2,(G,B,D)/8,(G,B,D)/8,(G,B,D)/8,(G,B,D)/8,(G,B,D)/8"

const partition = "(D,F#,A),-,(D,F#,A),(A,C#,E),(A,C#,E),(B,D,F#),(B,D,F#),(G,B,D),(G,B,D),(D,F#,A),(D,F#,A),(G,B,D),(G,B,D),(A,C#,E),(A,C#,E),(D,F#,A),(D,F#,A)";

const loop = async () => {
  prevTime = pauseBeforeStart;

  while (true) {
    prevTime = await playChords(parsePartition(partition), prevTime);
  }
}

loop();