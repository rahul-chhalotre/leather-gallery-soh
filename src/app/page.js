import { Suspense } from "react";
import Header from "./component/header/page";

import ProductTableCall from "./component/product_table/producttable";

export default function Home() {
  return (
    <>
      <Header />
      <ProductTableCall/>
    </>
  );
}
