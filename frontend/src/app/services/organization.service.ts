import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../dtos/api-response.dto';
import {
  CreateOrganizationDto,
  OrganizationDto,
} from '../../dtos/organization.dto';
import { OrganizationMvDto } from '../../dtos/organizationsMv.dto';
import { PaginatedList } from '../../dtos/paginated-list.dto';
import { sortOrderEnum } from '../../enums';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  private endpoint = environment.base_url;

  constructor(private httpClient: HttpClient) { }

  fetchOrganization(organizationId: string) {
    const url = this.endpoint + '/organizations/' + organizationId;
    return this.httpClient.get<ApiResponse<OrganizationDto>>(url).pipe(
      map((response) => ({ ...response, data: response.data ? this.withResolvedLogo(response.data) : response.data })),
    );
  }

  fetchOrganizations(name?: string, sortOptions?: { sortBy: string, sortOrder: sortOrderEnum }, skip: number = 0, take: number = 10) {
    const url = this.endpoint + '/organizations';

    let params = new HttpParams().set('skip', skip).set('take', take);

    if (name?.length ?? 0 > 0) {
      params = params.set('name', name!);
    }

    if (sortOptions) {
      params = params
        .set('sort_by', sortOptions.sortBy)
        .set('sort_order', sortOptions.sortOrder);
    }

    return this.httpClient.get<ApiResponse<PaginatedList<OrganizationMvDto>>>(url, { params });
  }

  createOrganization(body: CreateOrganizationDto) {
    const url = this.endpoint + '/organizations';
    return this.httpClient.post<ApiResponse<OrganizationDto>>(url, body).pipe(
      map((response) => ({ ...response, data: response.data ? this.withResolvedLogo(response.data) : response.data })),
    );
  }

  updateOrganization(organizationId: string, body: Partial<OrganizationDto>) {
    const url = `${this.endpoint}/organizations/${organizationId}`;
    return this.httpClient.patch<ApiResponse<OrganizationDto>>(url, body).pipe(
      map((response) => ({ ...response, data: response.data ? this.withResolvedLogo(response.data) : response.data })),
    );
  }

  uploadLogo(organizationId: string, file: File) {
    const body = new FormData();
    body.append('image', file);

    return this.httpClient.post<ApiResponse<OrganizationDto>>(
      `${this.endpoint}/organizations/${organizationId}/logo`,
      body,
    ).pipe(
      map((response) => ({ ...response, data: response.data ? this.withResolvedLogo(response.data) : response.data })),
    );
  }

  deleteOrganization(organizationId: string) {
    const url = `${this.endpoint}/organizations/${organizationId}`;
    return this.httpClient.delete<ApiResponse<null>>(url);
  }

  private withResolvedLogo(organization: OrganizationDto): OrganizationDto {
    const rawOrganization = organization as OrganizationDto & { logo_url?: string | null };
    const logoUrl = rawOrganization.logoUrl ?? rawOrganization.logo_url;

    return { ...organization, logoUrl: this.resolveLogoUrl(logoUrl ?? undefined) };
  }

  private resolveLogoUrl(logoUrl?: string): string | undefined {
    if (!logoUrl || logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
    if (environment.production) return logoUrl;
    return `${this.endpoint.replace(/\/api\/?$/, '')}${logoUrl}`;
  }

}
