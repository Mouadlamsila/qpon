import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
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
    return this.http.get<ApiResponse<RestaurantOfferDto[]>>(`${this.endpoint}/organizations/${organizationId}/offers`);
  }

  get(organizationId: string, offerId: string) {
    return this.http.get<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}`);
  }

  create(organizationId: string, body: CreateRestaurantOfferDto) {
    return this.http.post<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers`, body);
  }

  update(organizationId: string, offerId: string, body: Partial<CreateRestaurantOfferDto>) {
    return this.http.patch<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}`, body);
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
    return this.http.post<ApiResponse<RestaurantOfferDto>>(`${this.endpoint}/organizations/${organizationId}/offers/${offerId}/image`, body);
  }

  publicOffer(slug: string) {
    return this.http.get<ApiResponse<PublicRestaurantOfferDto>>(`${this.endpoint}/public/offers/${encodeURIComponent(slug)}`);
  }
}
