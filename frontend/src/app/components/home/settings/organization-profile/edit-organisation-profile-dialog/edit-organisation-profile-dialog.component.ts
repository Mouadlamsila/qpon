import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormDialogBoxComponent } from '../../../common/form-dialog-box/form-dialog-box.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { OrganizationStore } from '../../../../../store/organization.store';
import { OrganizationResolver } from '../../../../../resolvers/organization.resolver';
import { UpdateOrganizationDto } from '../../../../../../dtos/organization.dto';
import { instanceToPlain } from 'class-transformer';

@Component({
    selector: 'app-edit-organisation-profile-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        FormDialogBoxComponent
    ],
    templateUrl: './edit-organisation-profile-dialog.component.html'
})
export class EditOrganisationProfileDialogComponent {

    fb = inject(FormBuilder);
    snack = inject(SnackbarService);
    organizationResolver = inject(OrganizationResolver);

    form = this.fb.group({
        name: ['', Validators.required],
        description: [''],
        logoUrl: [''],
        contactEmail: ['', Validators.email],
        contactPhone: [''],
    });

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        public dialogRef: MatDialogRef<EditOrganisationProfileDialogComponent>
    ) {
        this.form.patchValue({
            name: data.name
            ,description: data.description ?? ''
            ,logoUrl: data.logoUrl ?? ''
            ,contactEmail: data.contactEmail ?? ''
            ,contactPhone: data.contactPhone ?? ''
        });
    }

    save = async () => {
        if (this.form.invalid) return;

        const updateOrganization = new UpdateOrganizationDto();
        updateOrganization.name = this.form.value.name!;
        updateOrganization.description = this.form.value.description || undefined;
        updateOrganization.logoUrl = this.form.value.logoUrl || undefined;
        updateOrganization.contactEmail = this.form.value.contactEmail || undefined;
        updateOrganization.contactPhone = this.form.value.contactPhone || undefined;

        try {
            await this.organizationResolver.update(this.data.organizationId, instanceToPlain(updateOrganization));

            this.snack.openSnackBar('Organization updated successfully', undefined);
            this.dialogRef.close();

        } catch (err) {
            this.snack.openSnackBar('Failed to update organization', undefined);
        }
    };

}
