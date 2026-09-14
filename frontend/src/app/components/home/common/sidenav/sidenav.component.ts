import { Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { MatListModule } from "@angular/material/list"
import { TranslatePipe } from '../../../../pipe/translate.pipe';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [MatSidenavModule, MatIconModule, MatListModule, RouterLinkActive, RouterLink, NgClass, TranslatePipe],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.css',
})
export class SidenavComponent {
  constructor(private router: Router, private route: ActivatedRoute) {}

  
}
