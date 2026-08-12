import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DispositivosForm } from './dispositivos-form';

describe('DispositivosForm', () => {
  let component: DispositivosForm;
  let fixture: ComponentFixture<DispositivosForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DispositivosForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DispositivosForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
