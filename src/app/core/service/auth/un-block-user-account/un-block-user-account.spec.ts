import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnBlockUserAccount } from './un-block-user-account';

describe('UnBlockUserAccount', () => {
  let component: UnBlockUserAccount;
  let fixture: ComponentFixture<UnBlockUserAccount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnBlockUserAccount],
    }).compileComponents();

    fixture = TestBed.createComponent(UnBlockUserAccount);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
