import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { OrganizationStatus } from '../../../enums';
import { PlatformRestaurantSummary } from '../../../dtos/platform-admin.dto';
import { PlatformAdminService } from '../../services/platform-admin.service';

@Component({
  selector: 'app-super-admin-organizations',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatTableModule],
  templateUrl: './super-admin-organizations.component.html',
  styleUrls: ['./super-admin-organizations.component.css'],
})
export class SuperAdminOrganizationsComponent implements OnInit {
  private readonly adminService = inject(PlatformAdminService);
  private readonly router = inject(Router);

  readonly statuses = OrganizationStatus;
  readonly restaurants = signal<PlatformRestaurantSummary[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  search = '';
  readonly columns = ['name', 'status', 'offers', 'claims', 'redemptions', 'actions'];

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading.set(true);
    this.error.set(null);
    this.adminService.list(this.search).subscribe({
      next: (response) => {
        this.restaurants.set(response.data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Unable to load restaurants. Please retry.');
        this.isLoading.set(false);
      },
    });
  }

  inspect(restaurant: PlatformRestaurantSummary) {
    this.router.navigate([`/${restaurant.organizationId}/home/dashboard`]);
  }

  toggleStatus(restaurant: PlatformRestaurantSummary, event: Event) {
    event.stopPropagation();
    const status = restaurant.status === OrganizationStatus.ACTIVE
      ? OrganizationStatus.SUSPENDED
      : OrganizationStatus.ACTIVE;
    this.adminService.updateStatus(restaurant.organizationId, status).subscribe({
      next: (response) => {
        const updated = response.data;
        if (!updated) return;
        this.restaurants.update((rows) => rows.map((row) => row.organizationId === updated.organizationId ? updated : row));
      },
      error: () => this.error.set('Unable to update restaurant status.'),
    });
  }

  createRestaurant() {
    this.router.navigate(['/organizations/create']);
  }
}
