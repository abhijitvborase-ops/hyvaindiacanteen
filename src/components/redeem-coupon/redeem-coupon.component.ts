import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { RouterLink } from '@angular/router';

// Declare Html5Qrcode global
declare var Html5Qrcode: any;

@Component({
  selector: 'app-redeem-coupon',
  templateUrl: './redeem-coupon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink]
})
export class RedeemCouponComponent implements OnDestroy {
  private dataService = inject(DataService);
  private html5QrCode: any;

  redeemStatusMessage = signal<{ type: 'success' | 'error', text: string } | null>(null);
  isScannerVisible = signal(false);
  scannerErrorMessage = signal<string | null>(null);

  redeemCouponForm = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.minLength(4), Validators.maxLength(4), Validators.pattern('^[0-9]*$')])
  });

  ngOnDestroy() {
    this.stopScanner();
  }
  
  showScanner() {
    this.isScannerVisible.set(true);
    this.scannerErrorMessage.set(null);
    // Use timeout to ensure the DOM element for the scanner is rendered
    setTimeout(() => this.startScanner(), 100);
  }
  
  hideScanner() {
    this.stopScanner();
    this.isScannerVisible.set(false);
  }

  private startScanner() {
    const readerElementId = 'qr-reader-redeem';
    if (!document.getElementById(readerElementId)) {
      this.scannerErrorMessage.set('QR Reader element could not be initialized. Please refresh.');
      console.error('QR Reader element not found in DOM.');
      return;
    }

    this.html5QrCode = new Html5Qrcode(readerElementId);
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const onScanSuccess = (decodedText: string) => {
      this.redeemCouponForm.patchValue({ code: decodedText });
      this.handleRedeemCoupon();
      this.hideScanner(); // Stop scanner on success
    };

    const onScanFailure = (error: string) => {};

    this.html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
      .catch((err: any) => {
        console.error('Unable to start QR scanner', err);
        this.scannerErrorMessage.set('Could not start scanner. Please check camera permissions.');
      });
  }
  
  private stopScanner() {
    if (this.html5QrCode && this.html5QrCode.isScanning) {
        this.html5QrCode.stop()
            .catch((err: any) => console.error("Error stopping the scanner.", err));
    }
  }

  handleRedeemCoupon() {
    if (this.redeemCouponForm.valid) {
      const code = this.redeemCouponForm.value.code!;
      const result = this.dataService.redeemCouponByCode(code);

      if (result.success) {
        this.redeemStatusMessage.set({ type: 'success', text: result.message });
      } else {
        this.redeemStatusMessage.set({ type: 'error', text: result.message });
      }

      this.redeemCouponForm.reset();
      
      setTimeout(() => this.redeemStatusMessage.set(null), 7000);
    }
  }
}
