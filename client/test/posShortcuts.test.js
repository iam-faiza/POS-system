import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shortcutAction, SHORTCUT_HINT } from '../src/utils/posShortcuts.js';

test('function keys map to POS actions', () => {
  assert.equal(shortcutAction('F2'), 'focusSearch');
  assert.equal(shortcutAction('F4'), 'checkout');
  assert.equal(shortcutAction('F6'), 'hold');
  assert.equal(shortcutAction('F7'), 'heldOrders');
  assert.equal(shortcutAction('F8'), 'cash');
  assert.equal(shortcutAction('F9'), 'card');
});

test('unrelated keys do nothing', () => {
  assert.equal(shortcutAction('a'), null);
  assert.equal(shortcutAction('F5'), null);
  assert.equal(shortcutAction('Enter'), null);
});

test('shortcuts are ignored while a dialog is open', () => {
  assert.equal(shortcutAction('F4', { dialogOpen: true }), null);
});

test('hint lists every shortcut', () => {
  assert.match(SHORTCUT_HINT, /F4 pay/);
  assert.match(SHORTCUT_HINT, /F9 card/);
});
