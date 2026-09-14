import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
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
    ).pipe(
      map((response) => ({
        ...response,
        data: response.data ? {
          ...response.data,
          offer: {
            ...response.data.offer,
            imageUrl: this.resolveImageUrl(response.data.offer.imageUrl),
            restaurant: {
              ...response.data.offer.restaurant,
              logoUrl: this.resolveImageUrl(response.data.offer.restaurant.logoUrl),
            },
          },
        } : response.data,
      })),
    );
  }

  private resolveImageUrl(imageUrl: string | null): string | null {
    if (!imageUrl || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (environment.production) return imageUrl;
    return `${this.endpoint.replace(/\/api\/?$/, '')}${imageUrl}`;
  }
}
