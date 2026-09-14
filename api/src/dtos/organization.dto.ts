import { PartialType } from '@nestjs/mapped-types';
import { Expose } from 'class-transformer';
import { Equals, IsString, IsDate, IsOptional, IsEmail, MaxLength, IsEnum } from 'class-validator';
import { organizationStatusEnum } from '../enums';

export class OrganizationDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.organization')
  entity = 'org.quicko.qpon.organization';

  @Expose({ name: 'organization_id' })
  organizationId: string;

  @IsString()
  name: string;

  @IsString()
  currency: string;

  @IsEnum(organizationStatusEnum)
  status: organizationStatusEnum;

  @IsOptional()
  @Expose({ name: 'external_id' })
  @IsString()
  externalId: string;

  @IsOptional()
  @Expose({ name: 'logo_url' })
  @IsString()
  logoUrl: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description: string | null;

  @IsOptional()
  @Expose({ name: 'contact_email' })
  @IsEmail()
  contactEmail: string | null;

  @IsOptional()
  @Expose({ name: 'contact_phone' })
  @IsString()
  contactPhone: string | null;

  @Expose({ name: 'created_at' })
  @IsDate()
  createdAt: Date;

  @Expose({ name: 'updated_at' })
  @IsDate()
  updatedAt: Date;
}

export class CreateOrganizationDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.organization')
  entity = 'org.quicko.qpon.organization';

  @IsString()
  name: string;

  @IsString()
  currency: string;

  @IsOptional()
  @Expose({ name: 'external_id' })
  @IsString()
  externalId: string;

  @IsOptional()
  @Expose({ name: 'logo_url' })
  @IsString()
  logoUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @Expose({ name: 'contact_email' })
  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @Expose({ name: 'contact_phone' })
  @IsString()
  contactPhone: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
