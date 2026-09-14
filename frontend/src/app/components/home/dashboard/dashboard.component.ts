import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RestaurantDashboard, RestaurantDashboardRedemption } from '../../../../dtos/restaurant-dashboard.dto';
import { SalesSummaryRow, transformSalesSummary } from '../../../utils/sales-summary.util';
import { DashboardService } from '../../../services/dashboard.service';
import { RestaurantDashboardService } from '../../../services/restaurant-dashboard.service';
import { DateRangeStore } from '../../../store/date-range.store';
import { OrganizationStore } from '../../../store/organization.store';
import { DateRangeFilterComponent } from '../../../layouts/range-selector/date-range-filter.component';
import { SalesTrendChartComponent } from './sales-chart/sales-trend-chart.component';
import { TranslatePipe } from '../../../pipe/translate.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, DateRangeFilterComponent, SalesTrendChartComponent, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  private readonly organizationStore = inject(OrganizationStore);
  private readonly dashboardService = inject(RestaurantDashboardService);
  private readonly salesService = inject(DashboardService);
  readonly dateRangeStore = inject(DateRangeStore);

  readonly organization = this.organizationStore.organizaiton;
  readonly dashboard = signal<RestaurantDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly salesGraph = signal<SalesSummaryRow[]>([]);
  readonly salesLoading = signal(false);
  private loadedOrganizationId: string | null = null;
  private loadedSalesKey: string | null = null;

  constructor() {
    effect(() => {
      const organizationId = this.organization()?.organizationId;
      if (!organizationId || organizationId === this.loadedOrganizationId) return;
      this.loadedOrganizationId = organizationId;
      void this.load(organizationId);
    });

    effect(() => {
      const organizationId = this.organization()?.organizationId;
      const start = this.dateRangeStore.start();
      const end = this.dateRangeStore.end();
      const range = this.dateRangeStore.activeRange();
      const key = `${organizationId ?? ''}:${range}:${start?.toISOString() ?? ''}:${end?.toISOString() ?? ''}`;
      if (!organizationId || key === this.loadedSalesKey) return;
      this.loadedSalesKey = key;
      void this.loadSalesSummary(organizationId, start, end);
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

  private async loadSalesSummary(organizationId: string, start: Date | null, end: Date | null) {
    this.salesLoading.set(true);
    try {
      const response = await firstValueFrom(this.salesService.fetchSalesSummary(organizationId, start ?? undefined, end ?? undefined));
      this.salesGraph.set(response?.data ? transformSalesSummary(response.data).graphData : []);
    } catch {
      this.salesGraph.set([]);
    } finally {
      this.salesLoading.set(false);
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
