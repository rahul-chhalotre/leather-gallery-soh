"use client";
import dynamic from "next/dynamic";
import Header from "./component/header/page";

// import ProductTableCall from "./component/product_table/producttable";
const ProductTableCall = dynamic(
  () => import("./component/product_table/producttable"),
  { ssr: false }
);

export default function Home() {
  return (
    <>
      <Header />
      <ProductTableCall/>
    </>
  );
}
