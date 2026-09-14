import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../dtos/api-response.dto';
import { PublicOfferClaimDto } from '../../dtos/offer-claim.dto';

@Injectable({ providedIn: 'root' })
export class OfferClaimService {
  private readonly endpoint = environment.base_url;

  constructor(private readonly http: HttpClient) {}

  create(publicSlug: string, email: string) {
    return this.http.post<ApiResponse<PublicOfferClaimDto>>(
      `${this.endpoint}/public/offers/${encodeURIComponent(publicSlug)}/claims`,
      { email: email.trim().toLowerCase() },
    );
  }

  get(retrievalToken: string) {
    return this.http.get<ApiResponse<PublicOfferClaimDto>>(
      `${this.endpoint}/public/claims/${encodeURIComponent(retrievalToken)}`,
    );
  }
}
