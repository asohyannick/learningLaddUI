import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FetchAllUsers } from './fetch-all-users';

describe('FetchAllUsers', () => {
  let component: FetchAllUsers;
  let fixture: ComponentFixture<FetchAllUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FetchAllUsers],
    }).compileComponents();

    fixture = TestBed.createComponent(FetchAllUsers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
