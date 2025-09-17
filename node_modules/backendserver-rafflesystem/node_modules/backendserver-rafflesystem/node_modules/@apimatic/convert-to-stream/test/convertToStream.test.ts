import { convertToStream } from '../src/convertToStream';
import { Readable } from 'stream';

describe('convertToStream', () => {
  it('should return Blob as-is', () => {
    const blob = new Blob(['blob content']);
    expect(convertToStream(blob)).toBe(blob);
  });

  it('should return NodeJS.ReadableStream as-is', () => {
    const stream = Readable.from(['stream content']);
    expect(convertToStream(stream)).toBe(stream);
  });

  it('should convert string to NodeJS.ReadableStream', () => {
    const str = 'hello world';
    const result = convertToStream(str);
    expect(result).toBeInstanceOf(Readable);
  });

  it('should convert empty string to NodeJS.ReadableStream that ends immediately', (done) => {
    const result = convertToStream('');
    if (result instanceof Readable) {
      let data = '';
      result.on('data', (chunk) => {
        data += chunk;
      });
      result.on('end', () => {
        expect(data).toBe('');
        done();
      });
    } else {
      done.fail('Expected a Readable stream');
    }
  });

  it('should convert string with binary data to NodeJS.ReadableStream', (done) => {
    const str = String.fromCharCode(0, 255, 127, 65); // binary-like string
    const result = convertToStream(str);
    if (result instanceof Readable) {
      let data = '';
      result.on('data', (chunk) => {
        data += chunk;
      });
      result.on('end', () => {
        expect(data).toBe(str);
        done();
      });
    } else {
      done.fail('Expected a Readable stream');
    }
  });
});
