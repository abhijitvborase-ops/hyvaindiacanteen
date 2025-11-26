import { Injectable, signal, inject } from '@angular/core';
import { Employee } from '../models/user.model';
import { Contractor } from '../models/contractor.model';
import { DataService } from './data.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private dataService = inject(DataService);
  // FIX: Explicitly type the injected Router to resolve type inference issue.
  private router: Router = inject(Router);
  currentUser = signal<Employee | Contractor | null>(null);

  login(loginId: string, password: string): { success: boolean, message?: string } {
    // Check employees first
    const employee = this.dataService.getEmployees().find(e => 
        e.employeeId === loginId && e.password === password
    );

    if (employee) {
        if (employee.status === 'deactivated') {
          return { success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
        }
        this.currentUser.set(employee);
        return { success: true };
    }

    // Then check contractors
    const contractor = this.dataService.getContractors().find(c =>
        c.contractorId === loginId && c.password === password
    );

    if (contractor) {
      this.currentUser.set(contractor);
      return { success: true };
    }

    return { success: false, message: 'Invalid Login ID or Password. Please try again.' };
  }

  logout() {
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  changePassword(currentPassword: string, newPassword: string): { success: boolean; message: string; } {
    const user = this.currentUser();
    if (!user) {
      return { success: false, message: 'No user is logged in.' };
    }

    if (user.password !== currentPassword) {
      return { success: false, message: 'The current password you entered is incorrect.' };
    }

    if ('role' in user) { // Employee
        this.dataService.changePassword(user.id, newPassword);
    } else { // Contractor
        this.dataService.changeContractorPassword(user.id, newPassword);
    }
    
    // Update the currentUser signal as well
    this.currentUser.update(u => u ? ({ ...u, password: newPassword }) : null);

    return { success: true, message: 'Password changed successfully.' };
  }
}
