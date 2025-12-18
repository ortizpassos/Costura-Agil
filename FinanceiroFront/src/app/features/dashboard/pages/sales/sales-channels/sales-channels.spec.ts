import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesChannelsComponent } from './sales-channels';

describe('SalesChannelsComponent', () => {
  let component: SalesChannelsComponent;
  let fixture: ComponentFixture<SalesChannelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesChannelsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesChannelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});