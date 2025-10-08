'use client';

import React, { Suspense } from 'react';
import ProductTable from '../producttabledata';

export default function ProductTableCall() {
  return (
    <Suspense fallback={<div>Loading products...</div>}>
      <ProductTable />
    </Suspense>
  );
}
