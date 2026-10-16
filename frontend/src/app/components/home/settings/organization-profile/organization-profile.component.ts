import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { OrganizationStore } from '../../../../store/organization.store';
import { EditOrganisationProfileDialogComponent } from './edit-organisation-profile-dialog/edit-organisation-profile-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { DeleteDialogComponent } from '../../common/delete-dialog/delete-dialog.component';
import { mobileAwareDialogConfig } from '../../../../utils/mobile-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { OrganizationResolver } from '../../../../resolvers/organization.resolver';
import { NotAllowedDialogBoxComponent } from '../../../common/not-allowed-dialog-box/not-allowed-dialog-box.component';
import { UserAbility } from '../../../../permissions/ability';
import { AbilityServiceSignal } from '@casl/angular';
import { CreateOrganizationDto, OrganizationDto } from '../../../../../dtos/organization.dto';
import { TranslatePipe } from '../../../../pipe/translate.pipe';

@Component({
  selector: 'app-organization-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDividerModule,
    MatCardModule,
    NgxSkeletonLoaderModule,
    TranslatePipe
  ],
  templateUrl: './organization-profile.component.html',
  styleUrls: ['./organization-profile.component.css']
})
export class OrganizationProfileComponent {

  organizationStore = inject(OrganizationStore);
  dialog = inject(MatDialog);
  snack = inject(SnackbarService);
  organizationResolver = inject(OrganizationResolver);

  private readonly abilityService = inject<AbilityServiceSignal<UserAbility>>(AbilityServiceSignal);
  protected readonly can = this.abilityService.can;

  openNotAllowedDialogBox(restrictionReason: string) {
    this.dialog.open(NotAllowedDialogBoxComponent, {
      data: {
        description: restrictionReason,
      }
    });
  }

  onEditName() {

    const hasPermission = this.can('update', OrganizationDto);

    if (!hasPermission) {
      this.openNotAllowedDialogBox('You do not have permission to edit restaurant details.');
      return;
    }

    this.dialog.open(EditOrganisationProfileDialogComponent, mobileAwareDialogConfig('516px', {
      name: this.organizationStore.organizaiton()?.name,
      description: this.organizationStore.organizaiton()?.description,
      logoUrl: this.organizationStore.organizaiton()?.logoUrl,
      contactEmail: this.organizationStore.organizaiton()?.contactEmail,
      contactPhone: this.organizationStore.organizaiton()?.contactPhone,
      currency: this.organizationStore.organizaiton()?.currency,
      organizationId: this.organizationStore.organizaiton()?.organizationId,
    }));
  }

  onDeleteOrganisation() {
    const org = this.organizationStore.organizaiton();

    const hasPermission = this.can('delete', CreateOrganizationDto);

    if (!hasPermission) {
      this.openNotAllowedDialogBox('You do not have permission to delete organisation.');
      return;
    }

    this.dialog.open(DeleteDialogComponent, {
      width: 'calc(100vw - 2rem)',
      maxWidth: '448px',
      data: {
        title: 'Delete restaurant?',
        description: `Are you sure you want to delete restaurant “${org?.name}”? You will lose all the associated data.`,
        onDelete: async () => {
          try {
            await this.organizationResolver.delete(org!.organizationId as string);

            this.snack.openSnackBar(
              'Organization deleted successfully',
              undefined
            );
            this.dialog.closeAll();
            window.location.href = window.location.origin + "/organizations";

          } catch (err) {
            this.snack.openSnackBar('Failed to delete organization', undefined);
          }
        }
      }
    });
  }
}
