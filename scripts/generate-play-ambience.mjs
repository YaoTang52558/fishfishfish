import { writeFileSync } from 'node:fs';

// Original stylized wave loops, not field recordings. Deterministic PCM 16kHz/mono/16bit.
for (const [name, seed0] of [['reef',1234],['rock',9876]]) {
  const count = 16000 * 8, wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(36 + count * 2,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(16000,24); wav.writeUInt32LE(32000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write('data',36); wav.writeUInt32LE(count * 2,40);
  let seed = seed0, low = 0;
  for (let i = 0; i < count; i++) {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296 * 2 - 1;
    low = low * .97 + noise * .03;
    const u = i / count, envelope = Math.sin(Math.PI * u) ** 2 * (.45 + .55 * Math.sin(Math.PI * (name === 'rock' ? 4 : 2) * u) ** 2);
    wav.writeInt16LE(Math.round((low * .8 + noise * (name === 'rock' ? .12 : .025)) * envelope * 11000),44 + i * 2);
  }
  writeFileSync(`public/audio/ambient-${name}.wav`,wav);
}
console.log('Generated two original 8-second wave loops.');
