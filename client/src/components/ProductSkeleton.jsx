import React from 'react';

export default function ProductSkeleton({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="product-card skeleton-card skeleton">
          <div className="skeleton-line skeleton" style={{ width: '75%', marginTop: '8px' }} />
          <div className="skeleton-line short skeleton" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <div className="skeleton-line short skeleton" style={{ width: '40%' }} />
            <div className="skeleton-line short skeleton" style={{ width: '30%' }} />
          </div>
        </div>
      ))}
    </>
  );
}