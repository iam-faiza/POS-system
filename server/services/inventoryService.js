async function saveInventoryAdjustment({ product, quantityAfter, userId, reason, session, StockMovementModel }) {
  const quantityBefore = product.stockQuantity;
  if (!Number.isSafeInteger(quantityAfter) || quantityAfter < 0) {
    throw new Error('Stock quantity must be a non-negative safe whole number');
  }

  product.stockQuantity = quantityAfter;
  const savedProduct = await product.save({ session });
  const quantityDelta = quantityAfter - quantityBefore;
  if (quantityDelta !== 0) {
    await new StockMovementModel({
      product: product._id,
      quantityDelta,
      quantityBefore,
      quantityAfter,
      type: 'adjustment',
      reason: reason || 'Admin inventory adjustment',
      user: userId
    }).save({ session });
  }
  return savedProduct;
}

module.exports = { saveInventoryAdjustment };