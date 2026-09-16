import { Component, Inject, inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormDialogBoxComponent } from '../../../common/form-dialog-box/form-dialog-box.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { OrganizationStore } from '../../../../../store/organization.store';
import { OrganizationResolver } from '../../../../../resolvers/organization.resolver';
import { UpdateOrganizationDto } from '../../../../../../dtos/organization.dto';
import { instanceToPlain } from 'class-transformer';
import { TranslatePipe } from '../../../../../pipe/translate.pipe';
import { LanguageService } from '../../../../../services/language.service';
import { environment } from '../../../../../../environments/environment';

@Component({
    selector: 'app-edit-organisation-profile-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        TranslatePipe,
        FormDialogBoxComponent
    ],
    templateUrl: './edit-organisation-profile-dialog.component.html'
})
export class EditOrganisationProfileDialogComponent implements OnDestroy {

    fb = inject(FormBuilder);
    snack = inject(SnackbarService);
    organizationResolver = inject(OrganizationResolver);
    languageService = inject(LanguageService);

    selectedLogoFile: File | null = null;
    logoPreviewUrl: string | null = null;
    showLogoInputs = false;
    readonly existingLogoUrl: string | null;
    readonly currencies = ['EUR', 'MAD', 'USD', 'GBP'];

    form = this.fb.group({
        name: ['', Validators.required],
        description: [''],
        logoUrl: ['', Validators.pattern(/^$|https?:\/\/\S+$/i)],
        currency: ['EUR', Validators.required],
        contactEmail: ['', Validators.email],
        contactPhone: [''],
    });

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        public dialogRef: MatDialogRef<EditOrganisationProfileDialogComponent>
    ) {
        this.existingLogoUrl = data.logoUrl ?? null;
        this.form.patchValue({
            name: data.name
            ,description: data.description ?? ''
            ,logoUrl: data.logoUrl ?? ''
            ,currency: data.currency ?? 'EUR'
            ,contactEmail: data.contactEmail ?? ''
            ,contactPhone: data.contactPhone ?? ''
        });
    }

    onLogoFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!supportedTypes.includes(file.type)) {
            this.snack.openSnackBar(this.languageService.translate('settings.logoTypeError'), undefined);
            input.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.snack.openSnackBar(this.languageService.translate('settings.logoSizeError'), undefined);
            input.value = '';
            return;
        }

        if (this.logoPreviewUrl) URL.revokeObjectURL(this.logoPreviewUrl);
        this.selectedLogoFile = file;
        this.logoPreviewUrl = URL.createObjectURL(file);
        this.showLogoInputs = true;
    }

    startLogoChange() {
        this.showLogoInputs = true;
        this.form.patchValue({ logoUrl: '' });
    }

    cancelLogoChange() {
        if (this.logoPreviewUrl) {
            URL.revokeObjectURL(this.logoPreviewUrl);
            this.logoPreviewUrl = null;
        }

        this.selectedLogoFile = null;
        this.showLogoInputs = false;
        this.form.patchValue({ logoUrl: this.existingLogoUrl ?? '' });

        const input = document.getElementById('restaurant-logo-file') as HTMLInputElement | null;
        if (input) input.value = '';
    }

    save = async () => {
        if (this.form.invalid) return;

        const updateOrganization = new UpdateOrganizationDto();
        updateOrganization.name = this.form.value.name!;
        updateOrganization.description = this.form.value.description || undefined;
        updateOrganization.logoUrl = this.selectedLogoFile ? undefined : this.toStoredLogoUrl(this.form.value.logoUrl || undefined);
        updateOrganization.currency = this.form.value.currency!;
        updateOrganization.contactEmail = this.form.value.contactEmail || undefined;
        updateOrganization.contactPhone = this.form.value.contactPhone || undefined;

        try {
            await this.organizationResolver.update(this.data.organizationId, instanceToPlain(updateOrganization));

            if (this.selectedLogoFile) {
                await this.organizationResolver.uploadLogo(this.data.organizationId, this.selectedLogoFile);
            }

            this.snack.openSnackBar(this.languageService.translate('settings.updateSuccess'), undefined);
            this.dialogRef.close();

        } catch (err) {
            this.snack.openSnackBar(this.languageService.translate('settings.updateFailed'), undefined);
        }
    };

    ngOnDestroy() {
        if (this.logoPreviewUrl) URL.revokeObjectURL(this.logoPreviewUrl);
    }

    private toStoredLogoUrl(logoUrl?: string) {
        if (!logoUrl) return undefined;
        const localApiOrigin = environment.base_url.replace(/\/api\/?$/, '');
        return logoUrl.startsWith(`${localApiOrigin}/uploads/`)
            ? logoUrl.slice(localApiOrigin.length)
            : logoUrl;
    }

}
