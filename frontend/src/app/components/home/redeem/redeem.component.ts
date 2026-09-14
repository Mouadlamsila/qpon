import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { OrganizationStore } from '../../../store/organization.store';
import { OfferClaimRedemptionService } from '../../../services/offer-claim-redemption.service';
import { OfferClaimValidation, OfferClaimRedemption } from '../../../../dtos/offer-claim-redemption.dto';

@Component({
  selector: 'app-redeem',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, CurrencyPipe, DatePipe],
  templateUrl: './redeem.component.html',
  styleUrl: './redeem.component.css',
})
export class RedeemComponent implements OnInit {
  readonly organizationStore = inject(OrganizationStore);
  private readonly redemptionService = inject(OfferClaimRedemptionService);

  claimCode = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(32)] });
  orderAmount = new FormControl<number | null>(null, [Validators.min(0.01)]);
  validation: OfferClaimValidation | null = null;
  redeemed: OfferClaimRedemption | null = null;
  history: OfferClaimRedemption[] = [];
  isValidating = false;
  isRedeeming = false;
  error: string | null = null;
  success: string | null = null;
  private idempotencyKey = crypto.randomUUID();

  constructor() {
    effect(() => {
      if (this.organizationStore.organizaiton()?.organizationId) this.loadHistory();
    });
  }

  ngOnInit() {
    this.loadHistory();
  }

  async validateClaim() {
    if (this.claimCode.invalid) return;
    this.error = null;
    this.success = null;
    this.redeemed = null;
    this.isValidating = true;
    try {
      const organizationId = this.organizationStore.organizaiton()?.organizationId;
      const amount = this.orderAmount.value ?? undefined;
      const response = await firstValueFrom(this.redemptionService.validate(organizationId!, this.claimCode.value, amount));
      this.validation = response.data ?? null;
      if (!this.validation?.valid) this.error = this.validation?.message ?? 'Claim cannot be redeemed';
    } catch (error: any) {
      this.validation = null;
      this.error = error?.error?.message ?? 'Unable to validate claim';
    } finally {
      this.isValidating = false;
    }
  }

  async redeemClaim() {
    if (!this.validation?.valid || this.orderAmount.invalid || this.orderAmount.value == null) return;
    this.error = null;
    this.isRedeeming = true;
    try {
      const organizationId = this.organizationStore.organizaiton()?.organizationId;
      const response = await firstValueFrom(this.redemptionService.redeem(organizationId!, this.claimCode.value, this.orderAmount.value, this.idempotencyKey));
      this.redeemed = response.data?.redemption ?? null;
      this.success = response.data?.message ?? 'Claim redeemed successfully';
      await this.loadHistory();
    } catch (error: any) {
      this.error = error?.error?.message ?? 'Unable to redeem claim';
    } finally {
      this.isRedeeming = false;
    }
  }

  reset() {
    this.claimCode.reset('');
    this.orderAmount.reset(null);
    this.validation = null;
    this.redeemed = null;
    this.error = null;
    this.success = null;
    this.idempotencyKey = crypto.randomUUID();
  }

  private async loadHistory() {
    const organizationId = this.organizationStore.organizaiton()?.organizationId;
    if (!organizationId) return;
    try {
      const response = await firstValueFrom(this.redemptionService.list(organizationId));
      this.history = response.data?.rows ?? [];
    } catch {
      this.history = [];
    }
  }
}
