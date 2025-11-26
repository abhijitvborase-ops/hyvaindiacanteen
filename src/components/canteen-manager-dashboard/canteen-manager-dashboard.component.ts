import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { Coupon } from '../../models/coupon.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-canteen-manager-dashboard',
  templateUrl: './canteen-manager-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink]
})
export class CanteenManagerDashboardComponent {
  private dataService = inject(DataService);

  selectedDate = signal(new Date().toISOString().split('T')[0]);

  couponTypes: Coupon['couponType'][] = ['Breakfast', 'Lunch/Dinner', 'Snacks', 'Beverage'];

  employeesMap = computed(() => {
    const map = new Map<number, string>();
    for (const emp of this.dataService.employees()) {
        map.set(emp.id, emp.name);
    }
    return map;
  });

  private allRedeemedCoupons = computed(() => {
    return this.dataService.coupons().filter(c => c.status === 'redeemed' && c.redeemDate);
  });

  todaysMenu = computed(() => {
    const today = new Date();
    const todayId = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    return this.dataService.getMenuForDate(todayId);
  });

  todayRedeemedBreakfast = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.allRedeemedCoupons().filter(c => 
      c.couponType === 'Breakfast' && 
      c.redeemDate!.startsWith(todayStr)
    ).length;
  });
  
  todayRedeemedLunchDinner = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.allRedeemedCoupons().filter(c => 
      c.couponType === 'Lunch/Dinner' && 
      c.redeemDate!.startsWith(todayStr)
    ).length;
  });

  monthlyRedeemedBreakfast = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return this.allRedeemedCoupons().filter(c => {
      if (c.couponType === 'Breakfast') {
        const redeemDate = new Date(c.redeemDate!);
        return redeemDate.getFullYear() === currentYear && redeemDate.getMonth() === currentMonth;
      }
      return false;
    }).length;
  });
  
  monthlyRedeemedLunchDinner = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return this.allRedeemedCoupons().filter(c => {
      if (c.couponType === 'Lunch/Dinner') {
        const redeemDate = new Date(c.redeemDate!);
        return redeemDate.getFullYear() === currentYear && redeemDate.getMonth() === currentMonth;
      }
      return false;
    }).length;
  });

  redeemedCouponsForDay = computed(() => {
    const selected = this.selectedDate();
    return this.allRedeemedCoupons().filter(c => c.redeemDate?.startsWith(selected));
  });

  groupedCoupons = computed(() => {
      const groups: { [key in Coupon['couponType']]?: Coupon[] } = {};
      for (const coupon of this.redeemedCouponsForDay()) {
          if (!groups[coupon.couponType]) {
              groups[coupon.couponType] = [];
          }
          groups[coupon.couponType]!.push(coupon);
      }
      return groups;
  });

  onDateChange(event: Event) {
    this.selectedDate.set((event.target as HTMLInputElement).value);
  }
  
  formatTime(isoString: string | null): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
