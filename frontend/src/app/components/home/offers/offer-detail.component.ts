import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RestaurantOfferDto } from '../../../../dtos/restaurant-offer.dto';
import { RestaurantOfferActivity } from '../../../../dtos/restaurant-dashboard.dto';
import { offerPublicationStatusEnum } from '../../../../enums';
import { RestaurantDashboardService } from '../../../services/restaurant-dashboard.service';
import { RestaurantOfferService } from '../../../services/restaurant-offer.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { OrganizationStore } from '../../../store/organization.store';

@Component({
  selector: 'app-offer-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, DecimalPipe, TitleCasePipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './offer-detail.component.html',
  styleUrl: './offer-detail.component.css',
})
export class OfferDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly organizationStore = inject(OrganizationStore);
  private readonly offerService = inject(RestaurantOfferService);
  private readonly dashboardService = inject(RestaurantDashboardService);
  private readonly snackbar = inject(SnackbarService);

  readonly organization = this.organizationStore.organizaiton;
  readonly statuses = offerPublicationStatusEnum;
  offer: RestaurantOfferDto | null = null;
  activity: RestaurantOfferActivity[] = [];
  loading = true;
  error: string | null = null;

  async ngOnInit() {
    await this.load();
  }

  async load() {
    const organizationId = this.organization()?.organizationId;
    const offerId = this.route.snapshot.paramMap.get('offer_id');
    if (!organizationId || !offerId) return;
    this.loading = true;
    this.error = null;
    try {
      const [offerResponse, activityResponse] = await Promise.all([
        firstValueFrom(this.offerService.get(organizationId, offerId)),
        firstValueFrom(this.dashboardService.getOfferActivity(organizationId, offerId)),
      ]);
      this.offer = offerResponse.data ?? null;
      this.activity = activityResponse.data ?? [];
    } catch {
      this.offer = null;
      this.activity = [];
      this.error = 'We could not load this offer.';
    } finally {
      this.loading = false;
    }
  }

  async changeStatus(action: 'publish' | 'pause' | 'archive') {
    const organizationId = this.organization()?.organizationId;
    if (!organizationId || !this.offer) return;
    try {
      await firstValueFrom(this.offerService[action](organizationId, this.offer.offerId));
      this.snackbar.openSnackBar(`Offer ${action}d`, undefined);
      await this.load();
    } catch {
      this.snackbar.openSnackBar(`Could not ${action} offer`, undefined);
    }
  }

  copyLink() {
    if (!this.offer) return;
    navigator.clipboard?.writeText(`${window.location.origin}/o/${this.offer.publicSlug}`);
    this.snackbar.openSnackBar('Public offer link copied', undefined);
  }

  edit() {
    if (!this.offer) return;
    void this.router.navigate(['edit'], { relativeTo: this.route });
  }

  currency() {
    return this.organization()?.currency ?? 'EUR';
  }
}
