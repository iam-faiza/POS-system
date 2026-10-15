import React from 'react';

export default function ProductSkeleton({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="product-card skeleton-card skeleton">
          <div className="skeleton-line skeleton w-75" />
          <div className="skeleton-line short skeleton" />
          <div className="skeleton-row">
            <div className="skeleton-line short skeleton w-40" />
            <div className="skeleton-line short skeleton w-30" />
          </div>
        </div>
      ))}
    </>
  );
}