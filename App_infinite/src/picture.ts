export class InvalidPicture extends Error {}
export const pictureByteLimit = 512 * 1024;
export const pictureDimensionLimit = 1600;
const prefix = "data:image/jpeg;base64,";

export function validatePicture(picture: string): void {
  if (picture === "") return;
  const invalid = () => { throw new InvalidPicture("Choose a supported picture of at most 512 KiB after resizing."); };
  if (typeof picture !== "string" || picture.length > prefix.length + Math.ceil(pictureByteLimit / 3) * 4 || !picture.startsWith(prefix)) return invalid();
  const encoded = picture.slice(prefix.length);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > pictureByteLimit || bytes.length < 20 || bytes.toString("base64") !== encoded ||
    bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return invalid();
  let offset = 2, frame = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) return invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0 || marker === 0xd8 || marker === 0xd9) return invalid();
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // TEM and RSTn carry no length.
    if (offset + 2 > bytes.length) return invalid();
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length - 2) return invalid();
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (frame || ![0xc0, 0xc2].includes(marker) || length < 8) return invalid();
      const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5), components = bytes[offset + 7]!;
      if (bytes[offset + 2] !== 8 || ![1, 3].includes(components) || length !== 8 + components * 3 ||
        !width || !height || width > pictureDimensionLimit || height > pictureDimensionLimit) return invalid();
      frame = true;
    }
    if (marker === 0xda) {
      if (!frame || length < 6 || length !== 6 + 2 * bytes[offset + 2]! || offset + length >= bytes.length - 2) return invalid();
      return;
    }
    offset += length;
  }
  return invalid();
}
