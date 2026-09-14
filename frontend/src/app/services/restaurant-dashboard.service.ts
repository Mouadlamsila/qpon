import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../dtos/api-response.dto';
import { RestaurantDashboard, RestaurantOfferActivity } from '../../dtos/restaurant-dashboard.dto';

@Injectable({ providedIn: 'root' })
export class RestaurantDashboardService {
  private readonly endpoint = environment.base_url;

  constructor(private readonly http: HttpClient) {}

  getDashboard(organizationId: string) {
    return this.http.get<ApiResponse<RestaurantDashboard>>(
      `${this.endpoint}/organizations/${organizationId}/restaurant-dashboard`,
    );
  }

  getOfferActivity(organizationId: string, offerId: string) {
    return this.http.get<ApiResponse<RestaurantOfferActivity[]>>(
      `${this.endpoint}/organizations/${organizationId}/offers/${offerId}/activity`,
    );
  }
}
