import { deflateSync } from 'node:zlib';

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, payload: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type),payload]);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(payload.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size,body,crc]);
}
/** 真正可解码的 RGBA PNG，而非只含 IHDR 的假图片。 */
export function pngBytes(seed: number, width=512, height=512): Uint8Array<ArrayBuffer> {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const stride=width*4+1;
  const scanlines = Buffer.alloc(stride*height,seed);
  for (let y=0;y<height;y+=1) scanlines[y*stride]=0;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',new Uint8Array())]));
}
