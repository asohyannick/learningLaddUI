import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginViaMagicLink } from './login-via-magic-link';

describe('LoginViaMagicLink', () => {
  let component: LoginViaMagicLink;
  let fixture: ComponentFixture<LoginViaMagicLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginViaMagicLink],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginViaMagicLink);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
