import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OrganizationStore } from '../../../store/organization.store';
import { RestaurantOfferService } from '../../../services/restaurant-offer.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { RestaurantOfferDto } from '../../../../dtos/restaurant-offer.dto';
import { offerPublicationStatusEnum, discountTypeEnum } from '../../../../enums';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, RouterLink],
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.css',
})
export class OffersComponent implements OnInit {
  private readonly organizationStore = inject(OrganizationStore);
  private readonly offerService = inject(RestaurantOfferService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  readonly organization = this.organizationStore.organizaiton;
  offers: RestaurantOfferDto[] = [];
  loading = true;
  readonly statuses = offerPublicationStatusEnum;

  async ngOnInit() {
    await this.load();
  }

  async load() {
    const organizationId = this.organization()?.organizationId;
    if (!organizationId) return;
    this.loading = true;
    try {
      this.offers = (await firstValueFrom(this.offerService.list(organizationId))).data ?? [];
    } finally {
      this.loading = false;
    }
  }

  open(offer: RestaurantOfferDto) {
    this.router.navigate(['/', this.organization()?.organizationId, 'home', 'offers', offer.offerId]);
  }

  edit(offer: RestaurantOfferDto) {
    this.router.navigate(['/', this.organization()?.organizationId, 'home', 'offers', offer.offerId, 'edit']);
  }

  async publish(offer: RestaurantOfferDto) { await this.changeStatus(offer, () => this.offerService.publish(this.organization()!.organizationId!, offer.offerId), 'published'); }
  async pause(offer: RestaurantOfferDto) { await this.changeStatus(offer, () => this.offerService.pause(this.organization()!.organizationId!, offer.offerId), 'paused'); }
  async archive(offer: RestaurantOfferDto) { await this.changeStatus(offer, () => this.offerService.archive(this.organization()!.organizationId!, offer.offerId), 'archived'); }

  copyLink(offer: RestaurantOfferDto) {
    const link = `${window.location.origin}/o/${offer.publicSlug}`;
    navigator.clipboard?.writeText(link);
    this.snackbar.openSnackBar('Public offer link copied', undefined);
  }

  discountLabel(offer: RestaurantOfferDto) {
    return offer.discountType === discountTypeEnum.PERCENTAGE
      ? `${offer.discountValue}% off`
      : `${offer.discountValue} ${this.organization()?.currency ?? ''} off`;
  }

  metric(offer: RestaurantOfferDto, key: 'claimCount' | 'redemptionCount' | 'redemptionRate') {
    return offer[key] ?? 0;
  }

  private async changeStatus(offer: RestaurantOfferDto, action: () => any, status: string) {
    try {
      await firstValueFrom(action());
      offer.publicationStatus = status as offerPublicationStatusEnum;
      this.snackbar.openSnackBar(`Offer ${status}`, undefined);
      await this.load();
    } catch {
      this.snackbar.openSnackBar(`Could not ${status} offer`, undefined);
    }
  }
}
