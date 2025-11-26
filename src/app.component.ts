import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/shared/header/header.component';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/shared/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    HeaderComponent,
    RouterOutlet,
    SidebarComponent
  ]
})
export class AppComponent {
  private authService = inject(AuthService);
  currentUser = this.authService.currentUser;

  isAdmin = computed(() => {
    const user = this.currentUser();
    // Check if the user is an employee and has the admin role
    return user && 'role' in user && user.role === 'admin';
  });

  logout() {
    this.authService.logout();
  }
}
