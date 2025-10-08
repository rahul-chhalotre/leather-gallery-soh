import React, { Suspense } from 'react'
import ProductTable from '../producttabledata'

const ProductTableCall = () => {
  return (
    <>
    <Suspense fallback={<div>Loading products...</div>}>
        <ProductTable />
      </Suspense>
    </>
  )
}

export default ProductTableCall