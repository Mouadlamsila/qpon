import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../dtos/api-response.dto';
import { PlatformRestaurantSummary } from '../../dtos/platform-admin.dto';
import { OrganizationStatus } from '../../enums';

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  private readonly endpoint = `${environment.base_url}/admin/restaurants`;

  constructor(private readonly http: HttpClient) {}

  list(search = '') {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ApiResponse<PlatformRestaurantSummary[]>>(this.endpoint, { params });
  }

  updateStatus(organizationId: string, status: OrganizationStatus) {
    return this.http.patch<ApiResponse<PlatformRestaurantSummary>>(`${this.endpoint}/${organizationId}/status`, { status });
  }
}
