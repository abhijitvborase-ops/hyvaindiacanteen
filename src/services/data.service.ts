import { Injectable, signal, computed, inject } from '@angular/core';
import { Employee } from '../models/user.model';
import { Coupon } from '../models/coupon.model';
import { AppNotification } from '../models/notification.model';
import { EmailService } from './email.service';
import { Contractor } from '../models/contractor.model';
import { DailyMenu } from '../models/menu.model';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private _employees = signal<Employee[]>([]);
  private _coupons = signal<Coupon[]>([]);
  private _notifications = signal<AppNotification[]>([]);
  private _contractors = signal<Contractor[]>([]);
  private _menus = signal<DailyMenu[]>([]);
  private emailService = inject(EmailService);

  // Public readonly signals
  employees = this._employees.asReadonly();
  coupons = this._coupons.asReadonly();
  notifications = this._notifications.asReadonly();
  contractors = this._contractors.asReadonly();
  menus = this._menus.asReadonly();
  contractorBusinessNames = computed(() => this._contractors().map(c => c.businessName).sort());

  // Computed totals
  totalIssuedCoupons = computed(() => this._coupons().length);
  totalRedeemedCoupons = computed(() => this._coupons().filter(c => c.status === 'redeemed').length);

  todaysIssuedCoupons = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this._coupons().filter(c => c.dateIssued.startsWith(todayStr)).length;
  });

  todaysRedeemedCoupons = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this._coupons().filter(c => c.status === 'redeemed' && c.redeemDate?.startsWith(todayStr)).length;
  });


  constructor() {
    this.seedData();
  }

  private seedData() {
    const initialEmployees: Employee[] = [
      { id: 1, name: 'Super Admin', employeeId: 'admin01', email: 'superadmin@canteen.com', password: 'superadmin', role: 'admin', department: 'System', status: 'active' }
    ];
    this._employees.set(initialEmployees);
    
    // Admin can now add contractors manually.
    const initialContractors: Contractor[] = [];
    this._contractors.set(initialContractors);

    this._coupons.set([]); // Start with no coupons
    this._notifications.set([]); // Start with no notifications
    
    // Start with no menus
    this._menus.set([]);
  }

  private generateRedemptionCode(): string {
    // Generate a 4-digit numeric code as a string
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private createCouponsForEmployee(employeeId: number, count: number, couponType: Coupon['couponType']): Coupon[] {
      const coupons: Coupon[] = [];
      const existingCodes = new Set(this._coupons().filter(c => c.status === 'issued').map(c => c.redemptionCode));
      
      for(let i=0; i< count; i++) {
        let newCode: string;
        do {
            newCode = this.generateRedemptionCode();
        } while (existingCodes.has(newCode)); // Ensure code is unique among active coupons
        existingCodes.add(newCode);

        coupons.push({
            couponId: this.generateCouponId(),
            employeeId: employeeId,
            dateIssued: new Date().toISOString(),
            status: 'issued',
            redeemDate: null,
            redemptionCode: newCode,
            couponType: couponType
        });
      }
      return coupons;
  }
  
  private generateCouponId(): string {
    return 'CPN-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  // Employee methods
  getEmployees(): Employee[] {
    return this._employees();
  }

  addEmployee(employeeData: Omit<Employee, 'id' | 'status'>): Employee {
    const newId = this._employees().reduce((maxId, employee) => Math.max(employee.id, maxId), 0) + 1;
    const newEmployee: Employee = {
        ...employeeData,
        id: newId,
        status: 'active'
    };
    this._employees.update(employees => [...employees, newEmployee]);
    return newEmployee;
  }

  updateEmployee(updatedEmployeeData: Employee): void {
    this._employees.update(employees => 
      employees.map(emp => emp.id === updatedEmployeeData.id ? updatedEmployeeData : emp)
    );
  }

  changePassword(employeeId: number, newPassword: string): void {
    this._employees.update(employees => 
      employees.map(emp => 
        emp.id === employeeId ? { ...emp, password: newPassword } : emp
      )
    );
  }

  deleteEmployee(employeeId: number): void {
    // Remove employee
    this._employees.update(employees => employees.filter(emp => emp.id !== employeeId));
    // Remove associated coupons
    this._coupons.update(coupons => coupons.filter(c => c.employeeId !== employeeId));
    // Remove associated notifications
    this._notifications.update(notifications => notifications.filter(n => n.employeeId !== employeeId));
  }

  toggleEmployeeStatus(employeeId: number): void {
    this._employees.update(employees => 
      employees.map(emp => {
        if (emp.id === employeeId) {
          const newStatus = emp.status === 'active' ? 'deactivated' : 'active';
          // NOTE: Coupon deletion logic is removed to preserve them.
          return { ...emp, status: newStatus };
        }
        return emp;
      })
    );
  }

  // Contractor methods
  getContractors(): Contractor[] {
    return this._contractors();
  }
  
  addContractor(contractorData: Omit<Contractor, 'id'>): Contractor {
    const newId = this._contractors().reduce((maxId, contractor) => Math.max(contractor.id, maxId), 0) + 1;
    const newContractor: Contractor = {
        ...contractorData,
        id: newId,
    };
    this._contractors.update(contractors => [...contractors, newContractor]);
    return newContractor;
  }

  updateContractor(updatedContractorData: Contractor): void {
    this._contractors.update(contractors => 
      contractors.map(c => c.id === updatedContractorData.id ? updatedContractorData : c)
    );
  }
  
  changeContractorPassword(contractorId: number, newPassword: string): void {
    this._contractors.update(contractors => 
      contractors.map(c => 
        c.id === contractorId ? { ...c, password: newPassword } : c
      )
    );
  }

  deleteContractor(contractorId: number): void {
    const contractorToDelete = this._contractors().find(c => c.id === contractorId);
    if(!contractorToDelete) return;
    
    // Un-assign contractor from employees
    this._employees.update(employees => employees.map(emp => {
      if(emp.contractor === contractorToDelete.businessName) {
        return { ...emp, contractor: undefined };
      }
      return emp;
    }));
    
    // Delete any coupons associated with this contractor (pool or assigned)
    this._coupons.update(coupons => coupons.filter(c => c.contractorId !== contractorId));

    // Delete contractor
    this._contractors.update(contractors => contractors.filter(c => c.id !== contractorId));
  }


  // Coupon methods
  getCouponsForEmployee(employeeId: number): Coupon[] {
    return this._coupons().filter(c => c.employeeId === employeeId);
  }

  removeCoupon(couponId: string): { success: boolean; message: string; } {
    const couponToRemove = this._coupons().find(c => c.couponId === couponId);

    if (!couponToRemove) {
      return { success: false, message: 'Coupon not found.' };
    }
    if (couponToRemove.status === 'redeemed') {
      return { success: false, message: 'Cannot remove a redeemed coupon.' };
    }
    this._coupons.update(coupons => coupons.filter(c => c.couponId !== couponId));
    return { success: true, message: `Coupon ${couponId} removed successfully.` };
  }

  generateCouponsForEmployee(employeeId: number, couponType: Coupon['couponType']): { success: boolean; message: string; } {
    const employee = this._employees().find(e => e.id === employeeId);
    if (!employee) {
      return { success: false, message: 'Employee not found.' };
    }

    if(employee.role !== 'employee') {
      return { success: false, message: `This function is only for permanent employees. Use the Contractors tab for contractual staff.` };
    }
  
    // Determine the monthly limit based on role and coupon type
    let limit = 0;
    if (couponType === 'Lunch/Dinner') {
      if (employee.role === 'employee') limit = 24;
    } else if (couponType === 'Breakfast') {
      if (employee.role === 'employee') {
        limit = 26;
      }
    }
  
    if (limit === 0) {
      return { success: false, message: `No monthly limit defined for ${couponType} coupons for this employee role.` };
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyCoupons = this._coupons().filter(c => {
      if (c.employeeId === employeeId && c.couponType === couponType) {
        const issueDate = new Date(c.dateIssued);
        return issueDate.getFullYear() === currentYear && issueDate.getMonth() === currentMonth;
      }
      return false;
    });

    const hasUnredeemedCoupons = monthlyCoupons.some(c => c.status === 'issued');

    // If there are any unredeemed coupons for the current month, block generation.
    if (hasUnredeemedCoupons) {
      return { 
        success: false, 
        message: `Employee must redeem all existing ${couponType} coupons for this month before new ones can be generated.` 
      };
    }
    
    // If all coupons are redeemed (or none exist for the month), generate a new full batch.
    const countToGenerate = limit;
    
    const newCoupons = this.createCouponsForEmployee(employeeId, countToGenerate, couponType);
    this._coupons.update(coupons => [...coupons, ...newCoupons]);
    
    this.emailService.sendCouponNotification(employee, countToGenerate, couponType);

    const newNotification: AppNotification = {
      id: `NTF-${Date.now()}-${Math.random()}`,
      employeeId: employeeId,
      message: `You have received ${countToGenerate} new ${couponType} coupon(s).`,
      type: 'new_coupon',
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this._notifications.update(notifications => [newNotification, ...notifications]);
    return { success: true, message: `${countToGenerate} ${couponType} coupons generated successfully for ${employee.name}.` };
  }

  generateCouponsForContractor(contractorId: number, couponType: Coupon['couponType'], quantity: number): { success: boolean; message: string; } {
    const contractor = this._contractors().find(c => c.id === contractorId);
    if (!contractor) {
      return { success: false, message: 'Contractor not found.' };
    }

    const newCoupons: Coupon[] = [];
    const existingCodes = new Set(this._coupons().filter(c => c.status === 'issued').map(c => c.redemptionCode));
      
    for(let i=0; i< quantity; i++) {
        let newCode: string;
        do {
            newCode = this.generateRedemptionCode();
        } while (existingCodes.has(newCode));
        existingCodes.add(newCode);

        newCoupons.push({
            couponId: this.generateCouponId(),
            contractorId: contractorId,
            dateIssued: new Date().toISOString(),
            status: 'issued',
            redeemDate: null,
            redemptionCode: newCode,
            couponType: couponType
        });
    }

    this._coupons.update(coupons => [...coupons, ...newCoupons]);

    return { success: true, message: `${quantity} ${couponType} coupons generated for ${contractor.businessName}.` };
  }

  assignCouponsToEmployee(contractorId: number, employeeId: number, couponType: Coupon['couponType'], quantity: number): { success: boolean; message: string; } {
    const availableCoupons = this._coupons().filter(c => c.contractorId === contractorId && c.couponType === couponType && c.status === 'issued' && !c.employeeId);
    
    if (availableCoupons.length < quantity) {
        return { success: false, message: `Not enough available ${couponType} coupons. You have ${availableCoupons.length}, but tried to assign ${quantity}.` };
    }
    
    const employee = this._employees().find(e => e.id === employeeId);
    if (!employee) {
        return { success: false, message: 'Employee not found.' };
    }

    const couponsToAssign = availableCoupons.slice(0, quantity);
    const couponIdsToAssign = new Set(couponsToAssign.map(c => c.couponId));

    this._coupons.update(coupons => 
        coupons.map(c => {
            if (couponIdsToAssign.has(c.couponId)) {
                return { ...c, employeeId: employeeId };
            }
            return c;
        })
    );
    
    // Create notification for employee
    const newNotification: AppNotification = {
      id: `NTF-${Date.now()}-${Math.random()}`,
      employeeId: employeeId,
      message: `You have received ${quantity} new ${couponType} coupon(s) from your contractor.`,
      type: 'new_coupon',
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this._notifications.update(notifications => [newNotification, ...notifications]);

    return { success: true, message: `${quantity} ${couponType} coupons assigned successfully to ${employee.name}.` };
  }

  redeemCoupon(couponId: string) {
    this._coupons.update(coupons => 
        coupons.map(c => 
            c.couponId === couponId && c.status === 'issued' 
            ? { ...c, status: 'redeemed', redeemDate: new Date().toISOString() } 
            : c
        )
    );
  }
  
  redeemCouponByCode(code: string): { success: boolean; message: string; } {
    const couponToRedeem = this._coupons().find(c => c.redemptionCode === code && c.status === 'issued');

    if (!couponToRedeem) {
        const alreadyRedeemed = this._coupons().find(c => c.redemptionCode === code && c.status === 'redeemed');
        if (alreadyRedeemed) {
            return { success: false, message: 'This coupon has already been redeemed.' };
        }
        return { success: false, message: 'Invalid coupon code.' };
    }

    if (couponToRedeem.isGuestCoupon) {
        const sharingEmployee = this._employees().find(u => u.id === couponToRedeem.sharedByEmployeeId);
        const successMessage = `Guest coupon redeemed successfully (shared by ${sharingEmployee?.name || 'Unknown'}).`;

        this._coupons.update(coupons => 
            coupons.map(c => 
                c.couponId === couponToRedeem.couponId 
                ? { ...c, status: 'redeemed', redeemDate: new Date().toISOString() } 
                : c
            )
        );

        return { success: true, message: successMessage };
    }

    if(!couponToRedeem.employeeId) {
      return { success: false, message: 'This coupon has not been assigned to an employee yet.' };
    }

    const employee = this._employees().find(u => u.id === couponToRedeem.employeeId);

    if (employee && employee.status === 'deactivated') {
        return { success: false, message: 'Cannot redeem coupon. Employee account is deactivated.' };
    }
    
    // Redeem normal employee coupon
    this._coupons.update(coupons => 
        coupons.map(c => 
            c.couponId === couponToRedeem.couponId 
            ? { ...c, status: 'redeemed', redeemDate: new Date().toISOString() } 
            : c
        )
    );
    
    return { success: true, message: `Coupon redeemed successfully for ${employee?.name}.` };
  }

  removeLastCouponBatch(employeeId: number): { success: boolean, message: string, removedCount: number } {
    const allCoupons = this._coupons();
    
    const employeeUnredeemedCoupons = allCoupons.filter(c => 
        c.employeeId === employeeId && c.status === 'issued'
    );

    if (employeeUnredeemedCoupons.length === 0) {
        return { success: false, message: 'No unredeemed coupons found for this employee.', removedCount: 0 };
    }

    let mostRecentDate = '';
    employeeUnredeemedCoupons.forEach(coupon => {
        if (coupon.dateIssued > mostRecentDate) {
            mostRecentDate = coupon.dateIssued;
        }
    });

    if (!mostRecentDate) {
        return { success: false, message: 'Could not determine the most recent coupon batch.', removedCount: 0 };
    }

    const couponsBeforeLength = allCoupons.length;

    const couponsAfter = allCoupons.filter(coupon => {
        const isFromLastBatch = coupon.employeeId === employeeId && 
                                coupon.status === 'issued' &&
                                coupon.dateIssued === mostRecentDate;
        return !isFromLastBatch;
    });

    const removedCount = couponsBeforeLength - couponsAfter.length;

    if (removedCount > 0) {
        this._coupons.set(couponsAfter);
        return { success: true, message: `Successfully removed the last batch of ${removedCount} coupon(s).`, removedCount };
    } else {
        return { success: false, message: 'No coupons were removed. An unexpected error occurred.', removedCount: 0 };
    }
  }

  generateGuestPassFromEmployeeCoupon(employeeId: number, couponType: Coupon['couponType']): { success: boolean; guestCoupon?: Coupon; message?: string; } {
    const GUEST_PASS_LIMIT = 5;
    const todayStr = new Date().toISOString().split('T')[0];

    const todaysGuestPasses = this._coupons().filter(c => 
        c.isGuestCoupon &&
        c.sharedByEmployeeId === employeeId &&
        c.couponType === couponType &&
        c.dateIssued.startsWith(todayStr)
    ).length;

    if (todaysGuestPasses >= GUEST_PASS_LIMIT) {
        return { success: false, message: `You have reached your daily limit of ${GUEST_PASS_LIMIT} ${couponType} guest passes.` };
    }

    let newCode: string;
    const existingCodes = new Set(this._coupons().filter(c => c.status === 'issued').map(c => c.redemptionCode));
    do {
        newCode = this.generateRedemptionCode();
    } while (existingCodes.has(newCode));

    const guestCoupon: Coupon = {
        couponId: this.generateCouponId(),
        dateIssued: new Date().toISOString(),
        status: 'issued',
        redeemDate: null,
        redemptionCode: newCode,
        couponType: couponType,
        isGuestCoupon: true,
        sharedByEmployeeId: employeeId,
    };

    this._coupons.update(coupons => [...coupons, guestCoupon]);

    return { success: true, guestCoupon: guestCoupon, message: 'Guest pass generated successfully.' };
  }

  // Notification Methods
  markNotificationAsRead(notificationId: string) {
    this._notifications.update(notifications =>
      notifications.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  }
  
  markAllNotificationsAsRead(employeeId: number) {
    this._notifications.update(notifications =>
      notifications.map(n => n.employeeId === employeeId ? { ...n, isRead: true } : n)
    );
  }

  // Menu Methods
  getMenuForDate(dateId: string): DailyMenu | undefined {
    return this._menus().find(m => m.id === dateId);
  }

  upsertMenu(menuData: Omit<DailyMenu, 'date'>) {
    const existingMenu = this._menus().find(m => m.id === menuData.id);
    const date = new Date(`${menuData.id}T12:00:00Z`); // Use noon to avoid timezone issues
    if (existingMenu) {
        this._menus.update(menus => 
            menus.map(m => m.id === menuData.id ? { ...menuData, date: date.toISOString() } : m)
        );
    } else {
        const newMenu: DailyMenu = {
            ...menuData,
            date: date.toISOString()
        };
        this._menus.update(menus => [...menus, newMenu]);
    }
  }
}
