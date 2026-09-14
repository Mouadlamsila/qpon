import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RestaurantOfferService } from '../../services/restaurant-offer.service';
import { PublicRestaurantOfferDto } from '../../../dtos/restaurant-offer.dto';
import { discountTypeEnum } from '../../../enums';

@Component({
  selector: 'app-public-offer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './public-offer.component.html',
  styleUrl: './public-offer.component.css',
})
export class PublicOfferComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(RestaurantOfferService);
  offer?: PublicRestaurantOfferDto;
  notFound = false;

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
}
