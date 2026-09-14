import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import QRCode from 'qrcode';
import { PublicOfferClaimDto } from '../../../dtos/offer-claim.dto';
import { discountTypeEnum } from '../../../enums';
import { OfferClaimService } from '../../services/offer-claim.service';

@Component({
  selector: 'app-claim',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './claim.component.html',
  styleUrl: './claim.component.css',
})
export class ClaimComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly claimService = inject(OfferClaimService);
  claim?: PublicOfferClaimDto;
  qrDataUrl = '';
  notFound = false;
  errorMessage = '';
  copied = false;

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('claim_token');
    if (!token) {
      this.notFound = true;
      return;
    }

    try {
      this.claim = (await firstValueFrom(this.claimService.get(token))).data;
      if (!this.claim) throw new Error('Claim response was incomplete');
      this.qrDataUrl = await QRCode.toDataURL(this.absoluteClaimUrl(), {
        width: 260,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
    } catch (error: any) {
      this.notFound = true;
      this.errorMessage = error?.error?.message || 'This claim could not be found.';
    }
  }

  discountLabel() {
    if (!this.claim) return '';
    return this.claim.offer.discountType === discountTypeEnum.PERCENTAGE
      ? `${this.claim.offer.discountValue}% off`
      : `${this.claim.offer.discountValue} off`;
  }

  absoluteClaimUrl() {
    return `${window.location.origin}${this.claim?.claimUrl || window.location.pathname}`;
  }

  async copyLink() {
    await navigator.clipboard.writeText(this.absoluteClaimUrl());
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }
}
