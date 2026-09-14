import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../dtos/api-response.dto';
import { OfferClaimRedemption, OfferClaimValidation, OfferRedemptionsPage } from '../../dtos/offer-claim-redemption.dto';

@Injectable({ providedIn: 'root' })
export class OfferClaimRedemptionService {
  private readonly endpoint = environment.base_url;

  constructor(private readonly http: HttpClient) {}

  validate(organizationId: string, claimCode: string, baseOrderValue?: number) {
    return this.http.post<ApiResponse<OfferClaimValidation>>(
      `${this.endpoint}/organizations/${organizationId}/offer-claims/validate`,
      {
        claim_code: claimCode.trim().toUpperCase(),
        ...(baseOrderValue == null ? {} : { base_order_value: baseOrderValue }),
      },
    );
  }

  redeem(organizationId: string, claimCode: string, baseOrderValue: number, idempotencyKey: string) {
    return this.http.post<ApiResponse<any>>(
      `${this.endpoint}/organizations/${organizationId}/offer-claims/redeem`,
      {
        claim_code: claimCode.trim().toUpperCase(),
        base_order_value: baseOrderValue,
        idempotency_key: idempotencyKey,
      },
    );
  }

  list(organizationId: string, skip = 0, take = 25) {
    return this.http.get<ApiResponse<OfferRedemptionsPage>>(
      `${this.endpoint}/organizations/${organizationId}/offer-redemptions?skip=${skip}&take=${take}`,
    );
  }
}
