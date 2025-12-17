import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GerarNfe } from './gerar-nfe';

describe('GerarNfe', () => {
  let component: GerarNfe;
  let fixture: ComponentFixture<GerarNfe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GerarNfe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GerarNfe);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
