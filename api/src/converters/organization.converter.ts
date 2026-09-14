import { Injectable } from '@nestjs/common';
import { Organization } from '../entities/organization.entity';
import { OrganizationDto } from '../dtos';

@Injectable()
export class OrganizationConverter {
  convert(organization: Organization): OrganizationDto {
    const organizationDto = new OrganizationDto();

    organizationDto.organizationId = organization.organizationId;
    organizationDto.name = organization.name;
    organizationDto.currency = organization.currency;
    organizationDto.externalId = organization.externalId;
    organizationDto.logoUrl = organization.logoUrl;
    organizationDto.description = organization.description;
    organizationDto.contactEmail = organization.contactEmail;
    organizationDto.contactPhone = organization.contactPhone;
    organizationDto.createdAt = organization.createdAt;
    organizationDto.updatedAt = organization.updatedAt;

    return organizationDto;
  }
}
