import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OfferClaimRedemption } from '../../../../dtos/offer-claim-redemption.dto';
import { OfferClaimRedemptionService } from '../../../services/offer-claim-redemption.service';
import { OrganizationStore } from '../../../store/organization.store';

@Component({
  selector: 'app-offer-redemptions',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './redemptions.component.html',
  styleUrl: './redemptions.component.css',
})
export class RedemptionsComponent implements OnInit {
  private readonly organizationStore = inject(OrganizationStore);
  private readonly redemptionService = inject(OfferClaimRedemptionService);

  readonly organization = this.organizationStore.organizaiton;
  rows: OfferClaimRedemption[] = [];
  loading = true;
  error: string | null = null;

  async ngOnInit() {
    await this.load();
  }

  async load() {
    const organizationId = this.organization()?.organizationId;
    if (!organizationId) return;
    this.loading = true;
    this.error = null;
    try {
      const response = await firstValueFrom(this.redemptionService.list(organizationId, 0, 100));
      this.rows = response.data?.rows ?? [];
    } catch {
      this.rows = [];
      this.error = 'We could not load redemptions. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  currency() {
    return this.organization()?.currency ?? 'EUR';
  }
}
