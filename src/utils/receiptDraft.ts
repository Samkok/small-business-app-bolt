import { ReceiptInput } from './receipt';

/**
 * Hand-off for a receipt that has no sale on the server yet (a sale made offline
 * and waiting to sync). The checkout screen builds the ReceiptInput from the cart
 * it still has in hand, stores it here, and opens /sales/receipt?draft=1. Route
 * params cannot carry an object of this size, and nothing here needs to survive
 * an app restart: once the sale syncs, the real receipt is printed from the sale.
 */
let draft: ReceiptInput | null = null;

export const receiptDraftStore = {
  set(input: ReceiptInput) {
    draft = input;
  },
  get(): ReceiptInput | null {
    return draft;
  },
  clear() {
    draft = null;
  },
};
