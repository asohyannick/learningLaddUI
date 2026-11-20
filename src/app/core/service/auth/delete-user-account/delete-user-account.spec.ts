import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteUserAccount } from './delete-user-account';

describe('DeleteUserAccount', () => {
  let component: DeleteUserAccount;
  let fixture: ComponentFixture<DeleteUserAccount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteUserAccount],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteUserAccount);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
