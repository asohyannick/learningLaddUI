import { EnumLabelPipe } from './enum-label-pipe';

describe('EnumLabelPipe', () => {
  const pipe = new EnumLabelPipe();

  it('turns enum values into sentence-case labels', () => {
    expect(pipe.transform('ALL_LEVELS')).toBe('All levels');
    expect(pipe.transform('BEGINNER')).toBe('Beginner');
  });

  it('keeps short acronyms and handles empty values', () => {
    expect(pipe.transform('NGO')).toBe('NGO');
    expect(pipe.transform(null)).toBe('');
  });
});
