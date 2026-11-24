import { TestBed } from '@angular/core/testing';
import { JobPhoto } from './job-photo';

describe('JobPhoto', () => {
  async function render(src: string | null, hideWhenMissing = false) {
    const fixture = TestBed.createComponent(JobPhoto);
    fixture.componentRef.setInput('src', src);
    fixture.componentRef.setInput('hideWhenMissing', hideWhenMissing);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the photo, then a placeholder instead of a broken image when it fails to load', async () => {
    const { fixture, el } = await render('https://example.org/missing.jpg');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.org/missing.jpg');
    img.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-testid="job-photo-placeholder"]')).not.toBeNull();

    // A new link gets a fresh try.
    fixture.componentRef.setInput('src', 'https://example.org/new.jpg');
    await fixture.whenStable();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://example.org/new.jpg');
  });

  it('shows a placeholder without a photo, or hides itself when asked to', async () => {
    const shown = await render(null);
    expect(shown.el.querySelector('[data-testid="job-photo-placeholder"]')).not.toBeNull();

    const { fixture, el } = await render('https://example.org/missing.jpg', true);
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.childElementCount).toBe(0);
    expect(el.classList.contains('hidden')).toBe(true);
  });
});
