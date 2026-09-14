import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RestaurantOfferService } from '../../services/restaurant-offer.service';
import { OfferClaimService } from '../../services/offer-claim.service';
import { PublicRestaurantOfferDto } from '../../../dtos/restaurant-offer.dto';
import { discountTypeEnum } from '../../../enums';

@Component({
  selector: 'app-public-offer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './public-offer.component.html',
  styleUrl: './public-offer.component.css',
})
export class PublicOfferComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(RestaurantOfferService);
  private readonly claimService = inject(OfferClaimService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  offer?: PublicRestaurantOfferDto;
  notFound = false;
  claimMode = false;
  claiming = false;
  claimError = '';
  readonly claimForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  async ngOnInit() {
    try {
      this.offer = (await firstValueFrom(this.service.publicOffer(this.route.snapshot.paramMap.get('offer_slug')!))).data;
    } catch {
      this.notFound = true;
    }
  }

  discountLabel() {
    if (!this.offer) return '';
    return this.offer.discountType === discountTypeEnum.PERCENTAGE
      ? `${this.offer.discountValue}% off`
      : `${this.offer.discountValue} off`;
  }

  showClaimForm() {
    this.claimMode = true;
    this.claimError = '';
  }

  async claimOffer() {
    if (this.claimForm.invalid || !this.offer || this.claiming) {
      this.claimForm.markAllAsTouched();
      return;
    }

    this.claiming = true;
    this.claimError = '';
    try {
      const slug = this.route.snapshot.paramMap.get('offer_slug')!;
      const claim = (await firstValueFrom(this.claimService.create(slug, this.claimForm.controls.email.value))).data;
      if (!claim?.claimUrl) throw new Error('Claim response was incomplete');
      await this.router.navigateByUrl(claim.claimUrl);
    } catch (error: any) {
      this.claimError = error?.error?.message || 'This offer could not be claimed. Please try again.';
    } finally {
      this.claiming = false;
    }
  }
}
