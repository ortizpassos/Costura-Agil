import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DispositivosList } from './dispositivos-list';

describe('DispositivosList', () => {
  let component: DispositivosList;
  let fixture: ComponentFixture<DispositivosList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DispositivosList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DispositivosList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
