export interface AppNotification {
  id: string;
  employeeId: number;
  message: string;
  type: 'new_coupon' | 'system';
  isRead: boolean;
  createdAt: string; // ISO string for date
}
