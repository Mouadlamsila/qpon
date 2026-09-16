import { Expose, Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';
import { roleEnum } from '../enums';

export class OrganizationUserDto {
  @Expose({ name: '@entity' })
  entity?: string = 'org.quicko.qpon.organization_user';

  @Expose({ name: 'organization_id' })
  @Transform(({ value }) => value, { toClassOnly: true })
  organizationId?: string;

  @IsString()
  name?: string;

  @Expose({ name: 'logo_url' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsString()
  role?: roleEnum;

  @Expose({ name: 'created_at' })
  @Transform(({ value }) => value, { toClassOnly: true })
  @IsDate()
  createdAt?: Date;

  @Expose({ name: 'updated_at' })
  @Transform(({ value }) => value, { toClassOnly: true })
  @IsDate()
  updatedAt?: Date;
}
