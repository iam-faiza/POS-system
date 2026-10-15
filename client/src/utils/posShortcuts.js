// Maps cashier keyboard keys to POS actions. Kept pure so it can be unit tested.
export const SHORTCUT_KEYS = {
  F2: 'focusSearch',
  F4: 'checkout',
  F6: 'hold',
  F7: 'heldOrders',
  F8: 'cash',
  F9: 'card',
};

export function shortcutAction(key, { dialogOpen = false } = {}) {
  if (dialogOpen) return null;
  return SHORTCUT_KEYS[key] || null;
}

export const SHORTCUT_HINT = 'F2 search · F4 pay · F6 hold · F7 held · F8 cash · F9 card';
