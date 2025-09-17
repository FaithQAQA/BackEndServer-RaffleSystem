import { convertFromStream as convertFromBlob } from '../src/convertFromBlob';
import { Readable } from 'stream';

describe('convertFromBlob', () => {
  it('should return string as-is', async () => {
    const input = 'hello world';
    const result = await convertFromBlob(input);
    expect(result).toBe(input);
  });

  it('should throw error if input is a NodeJS.ReadableStream', async () => {
    await expect(
      convertFromBlob(Readable.from(['stream content']))
    ).rejects.toThrow('Type must be Blob');
  });

  it('should convert a Blob to string', async () => {
    const blob = new Blob(['test blob']);
    const result = await convertFromBlob(blob);
    expect(result).toBe('test blob');
  });

  it('should handle empty Blob', async () => {
    const blob = new Blob(['']);
    const result = await convertFromBlob(blob);
    expect(result).toBe('');
  });

  it('should handle Blob with binary data', async () => {
    const binary = new Uint8Array([104, 101, 108, 108, 111]); // 'hello'
    const blob = new Blob([binary]);
    const result = await convertFromBlob(blob);
    expect(result).toBe('hello');
  });
});
