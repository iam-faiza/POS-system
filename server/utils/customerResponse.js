const CASHIER_CUSTOMER_FIELDS = '_id name phone createdAt';

function customerProjectionForRole(role) {
  return role === 'admin' ? null : CASHIER_CUSTOMER_FIELDS;
}

function customerResponseForRole(customer, role) {
  if (role === 'admin') return customer;
  const record = typeof customer.toObject === 'function' ? customer.toObject() : customer;
  return {
    _id: record._id,
    name: record.name,
    phone: record.phone,
    createdAt: record.createdAt
  };
}

module.exports = { customerProjectionForRole, customerResponseForRole };