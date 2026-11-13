import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupPermissionsByModule, hasFeatureAccess } from '../src/utils/featureAccess.js';

const registry = [
  { key: 'reports.view', label: 'View Reports', module: 'Reports', features: ['reports'] },
  { key: 'suppliers.view', label: 'View Suppliers', module: 'Suppliers', features: ['suppliers'] }
];

test('registered permissions automatically appear in role editor module groups', () => {
  const groups = groupPermissionsByModule(registry);
  assert.deepEqual(groups.map(({ title }) => title), ['Reports', 'Suppliers']);
  assert.equal(groups[0].permissions[0].key, 'reports.view');
});

test('feature access is granted only by the registered permission', () => {
  assert.equal(hasFeatureAccess({ permissions: ['reports.view'] }, registry, 'reports'), true);
  assert.equal(hasFeatureAccess({ permissions: ['sales.view_all'] }, registry, 'reports'), false);
  assert.equal(hasFeatureAccess({ permissions: ['suppliers.view'] }, registry, 'suppliers'), true);
  assert.equal(hasFeatureAccess({ permissions: [] }, registry, 'unregistered-feature'), false);
});