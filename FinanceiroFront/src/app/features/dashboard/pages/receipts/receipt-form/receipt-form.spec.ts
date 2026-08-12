import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReceiptForm } from './receipt-form';

describe('ReceiptForm', () => {
  let component: ReceiptForm;
  let fixture: ComponentFixture<ReceiptForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReceiptForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
