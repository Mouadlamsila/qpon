import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../dtos/api-response.dto';
import {
  CreateRestaurantOfferDto,
  PublicRestaurantOfferDto,
  RestaurantOfferDto,
} from '../../dtos/restaurant-offer.dto';

@Injectable({ providedIn: 'root' })
export class RestaurantOfferService {
  private readonly endpoint = environment.base_url;

  constructor(private readonly http: HttpClient) {}

  list(organizationId: string) {
    return this.http.get<ApiResponse<RestaurantOfferDto[]>>(`${this.endpoint}/organizations/${organizationId}/offers`).pipe(
      map((response) => ({ ...response, data: response.data?.map((offer) => this.withResolvedImage(offer)) ?? response.data })),
    );
  }

  get(organizationId: string, offerId: string) {
    return this.http.get<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}`).pipe(
      map((response) => ({ ...response, data: response.data ? this.withResolvedImage(response.data) : response.data })),
    );
  }

  create(organizationId: string, body: CreateRestaurantOfferDto) {
    return this.http.post<ApiResponse<RestaurantOfferDto>>(
      `${this.endpoint}/organizations/${organizationId}/offers`,
      this.toApiPayload(body),
    );
  }

  update(organizationId: string, offerId: string, body: Partial<CreateRestaurantOfferDto>) {
    return this.http.patch<ApiResponse<RestaurantOfferDto>>(
      `${this.endpoint}/organizations/${organizationId}/offers/${offerId}`,
      this.toApiPayload(body),
    );
  }

  publish(organizationId: string, offerId: string) {
    return this.http.post<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}/publish`, null);
  }

  pause(organizationId: string, offerId: string) {
    return this.http.post<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}/pause`, null);
  }

  archive(organizationId: string, offerId: string) {
    return this.http.post<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}/archive`, null);
  }

  uploadImage(organizationId: string, offerId: string, file: File) {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}/image`, body).pipe(
      map((response) => ({ ...response, data: response.data ? this.withResolvedImage(response.data) : response.data })),
    );
  }

  publicOffer(slug: string) {
    return this.http.get<ApiResponse<PublicRestaurantOfferDto>>(`${this.endpoint}/public/offers/${encodeURIComponent(slug)}`).pipe(
      map((response) => ({ ...response, data: response.data ? { ...response.data, imageUrl: this.resolveImageUrl(response.data.imageUrl) } : response.data })),
    );
  }

  private withResolvedImage(offer: RestaurantOfferDto): RestaurantOfferDto {
    return { ...offer, imageUrl: this.resolveImageUrl(offer.imageUrl) };
  }

  private resolveImageUrl(imageUrl: string | null): string | null {
    if (!imageUrl || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (environment.production) return imageUrl;
    return `${this.endpoint.replace(/\/api\/?$/, '')}${imageUrl}`;
  }

  private toApiPayload(body: Partial<CreateRestaurantOfferDto>) {
    return {
      '@entity': 'org.quicko.qpon.restaurant_offer',
      title: body.title,
      description: body.description,
      discount_type: body.discountType,
      discount_value: body.discountValue,
      discount_upto: body.discountUpto,
      minimum_amount: body.minimumAmount,
      valid_until: body.validUntil,
      max_redemptions: body.maxRedemptions,
      max_redemption_per_customer: body.maxRedemptionPerCustomer,
    };
  }
}
