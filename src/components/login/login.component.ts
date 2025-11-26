import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Validators, ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginComponent {
  private authService = inject(AuthService);
  // FIX: Explicitly type the injected Router to resolve type inference issue.
  private router: Router = inject(Router);

  errorMessage = signal<string | null>(null);

  loginForm = new FormGroup({
    loginId: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
    rememberMe: new FormControl(false)
  });
  
  async handleLogin() {
    if (this.loginForm.valid) {
      this.errorMessage.set(null);
      const { loginId, password } = this.loginForm.value;
      const result = this.authService.login(loginId!, password!);
      if (result.success) {
        const user = this.authService.currentUser();
        if (user) {
          // Check if user is an Employee (has a 'role' property)
          if ('role' in user) {
            let route = '/employee'; // default route
            if (user.role === 'admin') {
              route = '/admin';
            } else if (user.role === 'canteen manager') {
              route = '/canteen-manager';
            } else if (user.role === 'contractual employee') {
              route = '/contractual-employee';
            }
            await this.router.navigate([route]);
          } else {
            // User is a Contractor, redirect to contractor dashboard
            await this.router.navigate(['/contractor']);
          }
        }
      } else {
        this.errorMessage.set(result.message || 'An unknown error occurred.');
        setTimeout(() => this.errorMessage.set(null), 5000);
      }
    }
  }
}