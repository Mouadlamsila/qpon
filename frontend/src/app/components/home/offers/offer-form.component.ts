import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { discountTypeEnum } from '../../../../enums';
import { RestaurantOfferService } from '../../../services/restaurant-offer.service';
import { OrganizationStore } from '../../../store/organization.store';
import { SnackbarService } from '../../../services/snackbar.service';
import { RestaurantOfferDto } from '../../../../dtos/restaurant-offer.dto';

@Component({
  selector: 'app-offer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatRadioModule, RouterLink],
  templateUrl: './offer-form.component.html',
  styleUrl: './offer-form.component.css',
})
export class OfferFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offerService = inject(RestaurantOfferService);
  private readonly organizationStore = inject(OrganizationStore);
  private readonly snackbar = inject(SnackbarService);
  readonly organization = this.organizationStore.organizaiton;
  readonly discountTypes = discountTypeEnum;
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    discountType: [discountTypeEnum.PERCENTAGE, Validators.required],
    discountValue: [0, [Validators.required, Validators.min(0.01)]],
    discountUpto: [0],
    minimumAmount: [0],
    validUntil: ['', Validators.required],
    maxRedemptions: [0],
    maxRedemptionPerCustomer: [0],
  });
  offerId?: string;
  existing?: RestaurantOfferDto;
  selectedFile?: File;
  imagePreviewUrl: string | null = null;
  draggingImage = false;
  saving = false;
  private objectUrl: string | null = null;

  async ngOnInit() {
    this.offerId = this.route.snapshot.paramMap.get('offer_id') ?? undefined;
    if (this.offerId) {
      const response = await firstValueFrom(this.offerService.get(this.organization()!.organizationId!, this.offerId));
      this.existing = response.data;
      if (this.existing) {
        this.imagePreviewUrl = this.existing.imageUrl;
        this.form.patchValue({
          title: this.existing.title,
          description: this.existing.description ?? '',
          discountType: this.existing.discountType,
          discountValue: this.existing.discountValue,
          discountUpto: this.existing.discountUpto ?? 0,
          minimumAmount: this.existing.minimumAmount ?? 0,
          validUntil: this.existing.validUntil.slice(0, 16),
          maxRedemptions: this.existing.maxRedemptions ?? 0,
          maxRedemptionPerCustomer: this.existing.maxRedemptionPerCustomer ?? 0,
        });
      }
    }
  }

  chooseFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setImageFile(file, input);
  }

  onImageDragOver(event: DragEvent) {
    event.preventDefault();
    this.draggingImage = true;
  }

  onImageDragLeave(event: DragEvent) {
    event.preventDefault();
    this.draggingImage = false;
  }

  onImageDrop(event: DragEvent) {
    event.preventDefault();
    this.draggingImage = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setImageFile(file);
  }

  private setImageFile(file: File, input?: HTMLInputElement) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.snackbar.openSnackBar('Choose a JPEG, PNG, or WebP image up to 5 MB', undefined);
      if (input) input.value = '';
      return;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.imagePreviewUrl = this.objectUrl;
    this.selectedFile = file;
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  async save() {
    if (this.form.invalid || !this.organization()?.organizationId) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.form.getRawValue();
    const body = {
      title: value.title,
      description: value.description || undefined,
      discountType: value.discountType,
      discountValue: value.discountValue,
      discountUpto: value.discountUpto > 0 ? value.discountUpto : undefined,
      minimumAmount: value.minimumAmount > 0 ? value.minimumAmount : undefined,
      validUntil: new Date(value.validUntil).toISOString(),
      maxRedemptions: value.maxRedemptions > 0 ? value.maxRedemptions : undefined,
      maxRedemptionPerCustomer: value.maxRedemptionPerCustomer > 0 ? value.maxRedemptionPerCustomer : undefined,
    };
    try {
      const organizationId = this.organization()!.organizationId!;
      const response = this.offerId
        ? await firstValueFrom(this.offerService.update(organizationId, this.offerId, body))
        : await firstValueFrom(this.offerService.create(organizationId, body));
      const offer = response.data!;
      if (this.selectedFile) await firstValueFrom(this.offerService.uploadImage(organizationId, offer.offerId, this.selectedFile));
      this.snackbar.openSnackBar(this.offerId ? 'Offer updated' : 'Offer created as draft', undefined);
      await this.router.navigate(['/', organizationId, 'home', 'offers']);
    } catch {
      this.snackbar.openSnackBar('Could not save offer', undefined);
    } finally {
      this.saving = false;
    }
  }
}
