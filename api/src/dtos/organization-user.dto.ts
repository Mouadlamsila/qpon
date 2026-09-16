import { Expose } from 'class-transformer';
import { Equals, IsDate, IsOptional, IsString } from 'class-validator';
import { roleEnum } from '../enums';

export class OrganizationUserDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.organization_user')
  entity = 'org.quicko.qpon.organization_user';

  @Expose({ name: 'organization_id' })
  organizationId: string;

  @IsString()
  name: string;

  @Expose({ name: 'logo_url' })
  @IsOptional()
  @IsString()
  logoUrl: string | null;

  @IsString()
  role: roleEnum;

  @Expose({ name: 'created_at' })
  @IsDate()
  createdAt: Date;

  @Expose({ name: 'updated_at' })
  @IsDate()
  updatedAt: Date;
}
