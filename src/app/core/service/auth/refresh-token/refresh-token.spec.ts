import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RefreshToken } from './refresh-token';

describe('RefreshToken', () => {
  let component: RefreshToken;
  let fixture: ComponentFixture<RefreshToken>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefreshToken],
    }).compileComponents();

    fixture = TestBed.createComponent(RefreshToken);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
