import { TestBed } from '@angular/core/testing';
import { ProtectedRoutes } from './protected-routes';

describe('ProtectedRoutes', () => {
  let service: ProtectedRoutes;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProtectedRoutes);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
