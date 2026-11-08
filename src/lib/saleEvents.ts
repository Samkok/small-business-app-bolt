/**
 * A sale was recorded somewhere in the app. Screens that list or total sales listen and
 * reload; the Quick Checkout sheet is a modal, so the screen underneath never regains focus.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export const saleEvents = {
  emitRecorded() {
    listeners.forEach((l) => {
      try { l(); } catch (e) { console.warn('saleEvents listener failed', e); }
    });
  },
  onRecorded(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
