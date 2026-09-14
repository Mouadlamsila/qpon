import { Component, effect, inject, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { OrganizationStore } from '../../../store/organization.store';
import { OfferClaimRedemptionService } from '../../../services/offer-claim-redemption.service';
import { OfferClaimService } from '../../../services/offer-claim.service';
import { OfferClaimValidation, OfferClaimRedemption } from '../../../../dtos/offer-claim-redemption.dto';
import { TranslatePipe } from '../../../pipe/translate.pipe';

@Component({
  selector: 'app-redeem',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, CurrencyPipe, DatePipe, TranslatePipe],
  templateUrl: './redeem.component.html',
  styleUrl: './redeem.component.css',
})
export class RedeemComponent implements OnInit, OnDestroy {
  readonly organizationStore = inject(OrganizationStore);
  private readonly redemptionService = inject(OfferClaimRedemptionService);
  private readonly claimService = inject(OfferClaimService);

  @ViewChild('scannerVideo') private scannerVideo?: ElementRef<HTMLVideoElement>;

  claimCode = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(32)] });
  orderAmount = new FormControl<number | null>(null, [Validators.min(0.01)]);
  validation: OfferClaimValidation | null = null;
  redeemed: OfferClaimRedemption | null = null;
  history: OfferClaimRedemption[] = [];
  isValidating = false;
  isRedeeming = false;
  error: string | null = null;
  success: string | null = null;
  scannerOpen = false;
  scannerStatus = '';
  scannerError: string | null = null;
  private idempotencyKey = crypto.randomUUID();
  private scannerControls: IScannerControls | null = null;
  private qrReader: BrowserQRCodeReader | null = null;
  private processingScan = false;

  constructor() {
    effect(() => {
      if (this.organizationStore.organizaiton()?.organizationId) this.loadHistory();
    });
  }

  ngOnInit() {
    this.loadHistory();
  }

  ngOnDestroy() {
    this.stopScanner();
  }

  toggleScanner() {
    if (this.scannerOpen) {
      this.stopScanner();
      return;
    }

    this.scannerOpen = true;
    this.scannerError = null;
    this.scannerStatus = 'Starting camera…';
    setTimeout(() => void this.initializeScanner(), 0);
  }

  private async initializeScanner() {
    if (!this.scannerOpen) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.scannerStatus = '';
      this.scannerError = 'Camera access is not available here. Enter the claim code manually.';
      return;
    }

    try {
      const video = this.scannerVideo?.nativeElement;
      if (!video) {
        this.stopScanner();
        this.scannerOpen = true;
        this.scannerError = 'The QR scanner could not be opened. Enter the claim code manually.';
        return;
      }
      this.qrReader = new BrowserQRCodeReader();
      let startupTimeout: number | null = null;
      try {
        this.scannerControls = await Promise.race([
          this.qrReader.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            video,
            result => {
              if (result && this.scannerOpen && !this.processingScan) {
                void this.handleDecodedValue(result.getText());
              }
            },
          ),
          new Promise<never>((_, reject) => {
            startupTimeout = window.setTimeout(() => reject(new Error('Camera startup timed out')), 8000);
          }),
        ]);
      } finally {
        if (startupTimeout !== null) window.clearTimeout(startupTimeout);
      }
      if (!this.scannerOpen) {
        this.stopScanner();
        return;
      }
      this.scannerStatus = 'Point the camera at the customer’s QR code.';
    } catch (error: any) {
      this.stopScanner();
      this.scannerOpen = true;
      this.scannerError = error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Enter the claim code manually or allow camera access.'
        : 'Unable to start the QR scanner. Enter the claim code manually.';
      this.scannerStatus = '';
    }
  }

  private async handleDecodedValue(rawValue: string) {
    this.processingScan = true;
    try {
      await this.applyScannedValue(rawValue);
      const scanError = this.scannerError;
      this.stopScanner();
      if (scanError) this.scannerOpen = true;
    } finally {
      this.processingScan = false;
    }
  }

  private async applyScannedValue(rawValue: string) {
    let code = rawValue;
    const claimLink = rawValue.match(/(?:^|\/)claim\/([^/?#]+)/i);

    if (claimLink) {
      this.scannerStatus = 'Reading claim…';
      try {
        const response = await firstValueFrom(this.claimService.get(claimLink[1]));
        code = response.data?.displayCode ?? '';
        if (!code) throw new Error('Claim response was incomplete');
      } catch {
        this.scannerError = 'This QR claim could not be found. Enter the claim code manually.';
        this.scannerStatus = '';
        return;
      }
    }

    this.claimCode.setValue(code.toUpperCase());
    this.validation = null;
    this.error = null;
    this.success = null;
    this.scannerError = null;
    await this.validateClaim();
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
    this.stopScanner();
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

  private stopScanner() {
    this.scannerControls?.stop();
    this.scannerControls = null;
    this.qrReader = null;
    if (this.scannerVideo?.nativeElement) this.scannerVideo.nativeElement.srcObject = null;
    this.scannerOpen = false;
    this.scannerStatus = '';
  }
}
