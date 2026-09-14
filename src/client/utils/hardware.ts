/**
 * hardware.ts
 * Integrates WebUSB and barcode scanner listeners.
 */

// --- Barcode Scanner Keyboard Buffer Listener ---
let scanBuffer = '';
let lastKeyTime = 0;
const SCAN_TIMEOUT = 50; // Milliseconds threshold for scan keystrokes

export function initBarcodeScanner(onScan: (sku: string) => void): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only capture readable single characters or Enter
    if (e.key === 'Enter') {
      if (scanBuffer.length >= 3) {
        onScan(scanBuffer.trim());
      }
      scanBuffer = '';
      return;
    }

    if (e.key.length !== 1) return;

    const currentTime = Date.now();
    if (currentTime - lastKeyTime > SCAN_TIMEOUT) {
      // Keystroke delay too long -> reset buffer (treating as standard manual typing)
      scanBuffer = '';
    }

    scanBuffer += e.key;
    lastKeyTime = currentTime;
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

// --- WebUSB ESC/POS Printer Interface ---
export class WebUSBPrinter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private device: any = null;

  public async connect(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(navigator as any).usb) {
        throw new Error('WebUSB API is not supported by your browser.');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.device = await (navigator as any).usb.requestDevice({
        filters: [{ classCode: 7 }], // Printer class code standard
      });

      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error && error.name === 'NotFoundError') {
        console.warn('[WebUSB Connect] Device selection cancelled by user or no device selected.');
      } else {
        console.error('[WebUSB Connect Error]', err);
      }
      throw err;
    }
  }

  public async printReceipt(data: string): Promise<void> {
    if (!this.device) {
      throw new Error('No receipt printer connected.');
    }

    // Convert string receipt data to raw uint8 bytes for ESC/POS commands
    const encoder = new TextEncoder();
    const escInit = new Uint8Array([0x1b, 0x40]); // ESC @ (Initialize printer)
    const escCut = new Uint8Array([0x1d, 0x56, 0x41, 0x03]); // GS V A 3 (Paper Cut)

    const textBytes = encoder.encode(data);

    const payload = new Uint8Array(escInit.length + textBytes.length + escCut.length);
    payload.set(escInit, 0);
    payload.set(textBytes, escInit.length);
    payload.set(escCut, escInit.length + textBytes.length);

    // Send payload to USB Endpoint Out (typically endpoint #1 or #2)
    await this.device.transferOut(1, payload);
  }

  public async triggerCashDrawer(): Promise<void> {
    if (!this.device) {
      throw new Error('No printer connected to trigger cash drawer.');
    }
    // ESC p 0 25 250 (Trigger drawer kick pulses)
    const drawerCommand = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    await this.device.transferOut(1, drawerCommand);
  }
}
