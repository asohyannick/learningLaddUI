import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResendMagicLink } from './resend-magic-link';

describe('ResendMagicLink', () => {
  let component: ResendMagicLink;
  let fixture: ComponentFixture<ResendMagicLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResendMagicLink],
    }).compileComponents();

    fixture = TestBed.createComponent(ResendMagicLink);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
