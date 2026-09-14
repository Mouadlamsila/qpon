import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RestaurantDashboard, RestaurantDashboardRedemption } from '../../../../dtos/restaurant-dashboard.dto';
import { RestaurantDashboardService } from '../../../services/restaurant-dashboard.service';
import { OrganizationStore } from '../../../store/organization.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, RouterLink, CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  private readonly organizationStore = inject(OrganizationStore);
  private readonly dashboardService = inject(RestaurantDashboardService);

  readonly organization = this.organizationStore.organizaiton;
  readonly dashboard = signal<RestaurantDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private loadedOrganizationId: string | null = null;

  constructor() {
    effect(() => {
      const organizationId = this.organization()?.organizationId;
      if (!organizationId || organizationId === this.loadedOrganizationId) return;
      this.loadedOrganizationId = organizationId;
      void this.load(organizationId);
    });
  }

  async load(organizationId = this.organization()?.organizationId) {
    if (!organizationId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.dashboardService.getDashboard(organizationId));
      this.dashboard.set(response.data ?? null);
    } catch {
      this.dashboard.set(null);
      this.error.set('We could not load the restaurant dashboard. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  recentRows() {
    return this.dashboard()?.recentRedemptions ?? [];
  }

  currency() {
    return this.organization()?.currency ?? 'EUR';
  }

  customerLabel(row: RestaurantDashboardRedemption) {
    return row.customerEmail || 'Customer';
  }
}
