import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Dashboard } from './dashboard';

@NgModule({
				imports: [
					CommonModule,
					Dashboard,
					RouterModule.forChild([
						{ path: '', component: Dashboard }
					])
				]
})
export class DashboardModule {}
