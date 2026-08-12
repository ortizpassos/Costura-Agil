import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultarNfe } from './consultar-nfe';

describe('ConsultarNfe', () => {
  let component: ConsultarNfe;
  let fixture: ComponentFixture<ConsultarNfe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultarNfe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultarNfe);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
