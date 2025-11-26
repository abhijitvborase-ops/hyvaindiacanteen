import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-employee-dashboard', // Renamed selector
  templateUrl: './user-dashboard.component.html', // Filename is kept the same
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class EmployeeDashboardComponent { // Renamed class
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  
  currentEmployee = this.authService.currentUser;

  // Existing Modal Signals
  isRedeemModalOpen = signal(false);
  isHistoryModalOpen = signal(false);
  isGenerateGuestPassModalOpen = signal(false);
  
  // Existing State Signals
  selectedCouponForRedemption = signal<Coupon | null>(null);
  qrCodeDataUrl = signal<string | null>(null);

  // Guest Pass Generation State
  guestCouponDetails = signal<{ qrCode: string, code: string, type: Coupon['couponType'] } | null>(null);
  shareError = signal<string|null>(null);
  generationStep = signal<'select' | 'show'>('select');
  whatsAppShareMessage = signal('');
  copySuccess = signal(false);

  // New Guest Pass History Signals
  isGuestHistoryModalOpen = signal(false);
  isGuestQrModalOpen = signal(false);
  selectedGuestCouponForQr = signal<Coupon | null>(null);
  guestPassQrCodeDataUrl = signal<string | null>(null);
  
  guestPassTypes: Coupon['couponType'][] = ['Breakfast', 'Lunch/Dinner'];

  private getTodayId(): string {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  }


  private allEmployeeCoupons = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) return [];
    return this.dataService.getCouponsForEmployee(employee.id);
  });
  
  todaysMenu = computed(() => {
    return this.dataService.getMenuForDate(this.getTodayId());
  });

  nextAvailableCoupons = computed(() => {
    const issuedCoupons = this.allEmployeeCoupons().filter(c => c.status === 'issued');
    
    // Sort by date to easily find the oldest
    issuedCoupons.sort((a, b) => new Date(a.dateIssued).getTime() - new Date(b.dateIssued).getTime());
    
    const nextCouponsMap = new Map<Coupon['couponType'], Coupon>();
    for (const coupon of issuedCoupons) {
        if (!nextCouponsMap.has(coupon.couponType)) {
            nextCouponsMap.set(coupon.couponType, coupon);
        }
    }
    
    // To maintain a consistent order (e.g., Lunch then Breakfast)
    const mealTypeOrder: Coupon['couponType'][] = ['Lunch/Dinner', 'Breakfast', 'Snacks', 'Beverage'];
    const result: Coupon[] = [];
    for (const mealType of mealTypeOrder) {
        if (nextCouponsMap.has(mealType)) {
            result.push(nextCouponsMap.get(mealType)!);
        }
    }
    
    return result;
  });
  
  guestCouponStats = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) {
      return { generated: 0, redeemed: 0 };
    }
    
    const allCoupons = this.dataService.coupons();
    // Guest coupons are identified by isGuestCoupon and sharedByEmployeeId
    const generatedByMe = allCoupons.filter(c => c.isGuestCoupon && c.sharedByEmployeeId === employee.id);
    
    const redeemedCount = generatedByMe.filter(c => c.status === 'redeemed').length;

    return {
      generated: generatedByMe.length,
      redeemed: redeemedCount
    };
  });

  redeemedCouponsHistory = computed(() => {
    return this.allEmployeeCoupons()
      .filter(c => c.status === 'redeemed' && c.redeemDate)
      .sort((a, b) => new Date(b.redeemDate!).getTime() - new Date(a.redeemDate!).getTime());
  });
  
  generatedGuestCouponsHistory = computed(() => {
    const employee = this.currentEmployee();
    if (!employee) {
      return [];
    }
    return this.dataService.coupons()
      .filter(c => c.isGuestCoupon && c.sharedByEmployeeId === employee.id)
      .sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime());
  });

  totalCoupons = computed(() => this.allEmployeeCoupons().length);
  usedCoupons = computed(() => this.allEmployeeCoupons().filter(c => c.status === 'redeemed').length);
  remainingCoupons = computed(() => this.totalCoupons() - this.usedCoupons());

  async openRedeemModal(coupon: Coupon) {
    this.selectedCouponForRedemption.set(coupon);
    this.isRedeemModalOpen.set(true);
    this.qrCodeDataUrl.set(null); // Reset to show loading state

    try {
      const dataUrl = await QRCode.toDataURL(coupon.redemptionCode, { width: 256, margin: 2 });
      this.qrCodeDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR code', err);
      this.qrCodeDataUrl.set(null); // Handle error case
    }
  }

  closeRedeemModal() {
    this.isRedeemModalOpen.set(false);
    this.selectedCouponForRedemption.set(null);
    this.qrCodeDataUrl.set(null);
  }
  
  openGenerateGuestPassModal() {
    this.isGenerateGuestPassModalOpen.set(true);
    this.generationStep.set('select');
    this.guestCouponDetails.set(null);
    this.shareError.set(null);
    this.copySuccess.set(false);
    this.whatsAppShareMessage.set('');
  }

  closeGenerateGuestPassModal() {
    this.isGenerateGuestPassModalOpen.set(false);
  }
  
  async handleGeneratePass(couponType: Coupon['couponType']) {
    this.generationStep.set('show');
    this.shareError.set(null);
    this.guestCouponDetails.set(null);

    const employee = this.currentEmployee();
    if (!employee) {
        this.shareError.set("Could not verify current user. Please log in again.");
        return;
    }

    const result = this.dataService.generateGuestPassFromEmployeeCoupon(employee.id, couponType);

    if (result.success && result.guestCoupon) {
      try {
        const dataUrl = await QRCode.toDataURL(result.guestCoupon.redemptionCode, { width: 256, margin: 2 });
        this.guestCouponDetails.set({
            qrCode: dataUrl,
            code: result.guestCoupon.redemptionCode,
            type: result.guestCoupon.couponType
        });
        const message = `Here is your guest coupon for Hyva Canteen (${result.guestCoupon.couponType}). Your redemption code is: *${result.guestCoupon.redemptionCode}*`;
        this.whatsAppShareMessage.set(encodeURIComponent(message));

      } catch (err) {
        console.error('Failed to generate guest QR code', err);
        this.shareError.set("Successfully generated pass, but failed to create QR code.");
      }
    } else {
        this.shareError.set(result.message || "An unknown error occurred while generating the pass.");
    }
  }
  
  copyCodeToClipboard(code: string) {
    navigator.clipboard.writeText(code).then(() => {
        this.copySuccess.set(true);
        setTimeout(() => this.copySuccess.set(false), 2000);
    });
  }

  openHistoryModal() {
    this.isHistoryModalOpen.set(true);
  }
  
  closeHistoryModal() {
    this.isHistoryModalOpen.set(false);
  }

  openGuestHistoryModal() {
    this.isGuestHistoryModalOpen.set(true);
  }

  closeGuestHistoryModal() {
    this.isGuestHistoryModalOpen.set(false);
  }

  async openGuestQrModal(coupon: Coupon) {
    this.selectedGuestCouponForQr.set(coupon);
    this.isGuestQrModalOpen.set(true);
    this.guestPassQrCodeDataUrl.set(null); // Reset for loading state

    try {
      const dataUrl = await QRCode.toDataURL(coupon.redemptionCode, { width: 256, margin: 2 });
      this.guestPassQrCodeDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Failed to generate guest QR code', err);
      this.guestPassQrCodeDataUrl.set(null);
    }
  }

  closeGuestQrModal() {
    this.isGuestQrModalOpen.set(false);
    this.selectedGuestCouponForQr.set(null);
    this.guestPassQrCodeDataUrl.set(null);
  }

  getCouponTypeClass(couponType: Coupon['couponType']): string {
    switch (couponType) {
      case 'Breakfast':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Lunch/Dinner':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Snacks':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Beverage':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }
  
  formatDateTime(isoString: string | null): string {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
