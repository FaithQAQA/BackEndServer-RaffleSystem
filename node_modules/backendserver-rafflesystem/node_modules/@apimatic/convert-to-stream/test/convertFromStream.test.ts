import { Readable } from 'stream';
import { convertFromStream } from '../src';

describe('convertFromStream', () => {
  it('should return string as-is', async () => {
    const input = 'hello world';
    const result = await convertFromStream(input);
    expect(result).toBe(input);
  });

  it('should delegate to Blob logic', async () => {
    const blob = new Blob(['blob content']);
    const result = await convertFromStream(blob);
    expect(result).toBe('blob content');
  });

  it('should convert a NodeJS.ReadableStream to string', async () => {
    const stream = Readable.from(['stream content']);
    const result = await convertFromStream(stream);
    expect(result).toBe('stream content');
  });

  it('should handle empty NodeJS.ReadableStream', async () => {
    const stream = Readable.from([]);
    const result = await convertFromStream(stream);
    expect(result).toBe('');
  });

  it('should handle NodeJS.ReadableStream with binary data', async () => {
    const binary = Buffer.from([104, 101, 108, 108, 111]); // 'hello'
    const stream = Readable.from([binary]);
    const result = await convertFromStream(stream);
    expect(result).toBe('hello');
  });
});
