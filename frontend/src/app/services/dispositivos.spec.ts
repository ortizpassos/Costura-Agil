import { TestBed } from '@angular/core/testing';

import { Dispositivos } from './dispositivos';

describe('Dispositivos', () => {
  let service: Dispositivos;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Dispositivos);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
