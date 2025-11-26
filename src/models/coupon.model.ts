




export interface Coupon {
  couponId: string;
  employeeId?: number;
  contractorId?: number;
  dateIssued: string;
  status: 'issued' | 'redeemed';
  redeemDate: string | null;
  redemptionCode: string;
  couponType: 'Breakfast' | 'Lunch/Dinner' | 'Snacks' | 'Beverage';
  isGuestCoupon?: boolean;
  sharedByEmployeeId?: number;
}