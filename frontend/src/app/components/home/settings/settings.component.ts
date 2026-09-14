import { Component } from '@angular/core';
import { MatTabGroup, MatTab } from "@angular/material/tabs";
import { UserProfileComponent } from "./user-profile/user-profile.component";
import { OrganizationProfileComponent } from "./organization-profile/organization-profile.component";
import { TeamUsersComponent } from "./team/team.component";
import { TranslatePipe } from '../../../pipe/translate.pipe';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  imports: [MatTabGroup, MatTab, UserProfileComponent, OrganizationProfileComponent, TeamUsersComponent, TranslatePipe],
})
export class SettingsComponent {
}
