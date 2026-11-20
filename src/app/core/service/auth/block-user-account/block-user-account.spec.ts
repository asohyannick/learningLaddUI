import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockUserAccount } from './block-user-account';

describe('BlockUserAccount', () => {
  let component: BlockUserAccount;
  let fixture: ComponentFixture<BlockUserAccount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockUserAccount],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockUserAccount);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
