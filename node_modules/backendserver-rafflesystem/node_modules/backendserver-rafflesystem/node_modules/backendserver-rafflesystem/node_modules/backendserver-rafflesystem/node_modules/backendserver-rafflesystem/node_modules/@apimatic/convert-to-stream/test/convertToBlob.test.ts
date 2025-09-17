import { convertToStream } from '../src/convertToBlob';
import { convertFromStream } from '../src/convertFromBlob';
import { Readable } from 'stream';

describe('convertToStream (from convertToBlob.ts)', () => {
  it('should return Blob as-is', () => {
    const blob = new Blob(['blob content']);
    expect(convertToStream(blob)).toBe(blob);
  });

  it('should return Readable Stream as-is', () => {
    const stream = Readable.from(['stream content']);
    expect(convertToStream(stream)).toBe(stream);
  });

  it('should convert string to Blob', () => {
    const str = 'hello world';
    const blob = convertToStream(str);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('should convert empty string to empty Blob', async () => {
    const str = '';
    const blob = convertToStream(str);
    expect(await convertFromStream(blob)).toBe(str);
  });

  it('should convert string with binary data to Blob', () => {
    const str = String.fromCharCode(0, 255, 127, 65); // binary-like string
    const blob = convertToStream(str);
    expect(blob).toBeInstanceOf(Blob);
  });
});
