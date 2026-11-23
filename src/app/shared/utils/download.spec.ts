import { fileNameFromDisposition } from './download';

describe('fileNameFromDisposition', () => {
  it('reads quoted, plain and encoded file names', () => {
    expect(fileNameFromDisposition('attachment; filename="intro.pdf"')).toBe('intro.pdf');
    expect(fileNameFromDisposition('attachment; filename=intro.pdf')).toBe('intro.pdf');
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''caf%C3%A9.pdf")).toBe('café.pdf');
    expect(fileNameFromDisposition(null)).toBeNull();
    expect(fileNameFromDisposition('inline')).toBeNull();
  });
});
