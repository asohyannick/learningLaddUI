import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakePublicPartner } from '../../../core/testing/fake-partner';
import { PartnerType } from '../partnership.model';
import { PartnerCarousel } from './partner-carousel';

describe('PartnerCarousel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerCarousel],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function render(count: number) {
    const fixture = TestBed.createComponent(PartnerCarousel);
    const partners = Array.from({ length: count }, (_, i) =>
      fakePublicPartner({
        id: `p${i}`,
        name: `Partner ${i}`,
        slug: `partner-${i}`,
        sponsorshipTier: undefined,
        partnerType: PartnerType.ACADEMIC,
      }),
    );
    fixture.componentRef.setInput('partners', partners);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('repeats the list into two identical halves for a seamless loop', () => {
    const el = render(3);
    const items = [...el.querySelectorAll('li')];
    expect(items).toHaveLength(24);
    const names = items.map((li) => li.textContent?.trim());
    expect(names.slice(0, 12)).toEqual(names.slice(12));
    expect(el.querySelector('.track')?.getAttribute('style')).toContain('--duration: 36s');
  });

  it('keeps only one copy of each partner for screen readers and the keyboard', () => {
    const el = render(3);
    const visible = [...el.querySelectorAll('li:not([aria-hidden])')];
    expect(visible.map((li) => li.textContent?.trim())).toEqual([
      expect.stringContaining('Partner 0'),
      expect.stringContaining('Partner 1'),
      expect.stringContaining('Partner 2'),
    ]);
    const hiddenLinks = el.querySelectorAll('li[aria-hidden="true"] a[tabindex="-1"]');
    expect(hiddenLinks).toHaveLength(21);
    expect(visible[0].querySelector('a')?.getAttribute('href')).toBe('/partners/partner-0');
    expect(visible[0].textContent).toContain('Academic');
  });

  it('can be paused and played again', () => {
    const el = render(12);
    const toggle = el.querySelector<HTMLButtonElement>('button')!;
    expect(toggle.textContent).toContain('Pause');
    toggle.click();
    TestBed.tick();
    expect(el.querySelector('.marquee')?.classList).toContain('paused');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toContain('Play');
  });
});
