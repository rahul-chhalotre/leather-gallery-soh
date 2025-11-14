"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  CircularProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Skeleton,
} from "@mui/material";

const normalizeLocation = (loc) => loc?.toLowerCase().replace(/\s+/g, "") || "";
const API_AUTH_ACCOUNT_ID = "f8354924-2075-4fd3-8578-a64bf0b1b4c2";
const API_AUTH_APPLICATION_KEY = "f4daba60-021e-66e9-43c2-df6a73740a65";


export default function ProductTable() {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(
    "Riverhorse Valley-Warehouse"
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  const [openPopup, setOpenPopup] = useState(false);
  const [popupData, setPopupData] = useState([]);
  const [popupLoading, setPopupLoading] = useState(false);

  const [bomComponents, setBomComponents] = useState([]);
  const [bomLoading, setBomLoading] = useState(false);

  const [dueInOrders, setDueInOrders] = useState([]);
  const [dueInLoading, setDueInLoading] = useState(false);
  const [dueOutOrders, setDueOutOrders] = useState([]);
  const [dueOutLoading, setDueOutLoading] = useState(false);
  const [allProduct, setAllProduct] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get("search") || "";
    // const nameQuery = params.get("name") || "";
    const locationQuery = params.get("Location") || "";

    if (searchQuery) setSkuSearch(searchQuery);
    // if (nameQuery) setNameSearch(nameQuery);
    if (locationQuery) setSelectedLocation(locationQuery);
  }, []);

  const searchTimeout = useRef(null);
  const locationOptions = [
    { Name: "Riverhorse Valley-Warehouse" },
    { Name: "Deco Park Warehouse" },
  ];

  const loadDueInOrders = async () => {
    setDueInLoading(true);
    try {
      const res = await fetch(
        `/api/purchase_orders?OrderStatus=AUTHORISED&RestockReceivedStatus=DRAFT`
      );
      if (!res.ok) throw new Error("Failed to fetch due-in orders");
      const data = await res.json();
      console.log("All Purchase Data", data);
      const allOrders = data.purchaseOrders || [];

      const getYearMonth = (dateString) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${date.toLocaleString("default", {
          month: "short",
        })}`;
      };

      let c_data = [];
      const groupedOrders = allOrders.reduce((acc, order) => {
        if (order.Status !== "RECEIVED") {
          if (!order.RequiredBy) return acc;
          const month = getYearMonth(order.RequiredBy);
          acc[month] = acc[month] || [];
          acc[month].push({
            Location: order.Location,
            requireby: order.RequiredBy,
            orderNumber: order.OrderNumber,
            orders: order.Order.Lines.map((line) => ({
              SKU: line.SKU,
              Quantity: line.Quantity,
            })),
            status: order.Status,
            put_away: order.PutAway
          });
        }
        // console.log("group",groupedOrders);
        return acc;
      }, {});

      setDueInOrders(groupedOrders);
    } catch (err) {
      console.error("Error fetching due-in orders:", err);
    } finally {
      setDueInLoading(false);
    }
  };

  const loadDueOutOrders = async () => {
    setDueOutLoading(true);
    try {
      const res = await fetch(
        `/api/sale_orders?OrderStatus=AUTHORISED&FulfilmentStatus=NOTFULFILLED`
      );
      if (!res.ok) throw new Error("Failed to fetch due-out orders");
      const data = await res.json();
      console.log("all sales data", data);
      const allOrders = data.saleOrders || [];

      const getYearMonth = (dateString) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${date.toLocaleString("default", {
          month: "short",
        })}`;
      };
      console.log(
        "All orders:",
        allOrders.map((o) => o.Order?.SaleOrderNumber)
      );

      const groupedOrders = allOrders.reduce((acc, order) => {
        if (order.Status !== 'COMPLETED') {
          // if (!order.ShipBy) return acc;

          const month = getYearMonth(order.ShipBy);
          acc[month] = acc[month] || [];
          acc[month].push({
            Location: order.Location,
            shipby: order.ShipBy,
            orderNumber: order.Order.SaleOrderNumber,
            orders: order.Order.Lines.map((line) => ({
              SKU: line.SKU,
              Quantity: line.Quantity,
            })),
          });
        }
        return acc;
      }, {});

      setDueOutOrders(groupedOrders);
      console.log(groupedOrders,"groupOrders")
    } catch (err) {
      console.error("Error fetching due-out orders:", err);
    } finally {
      setDueOutLoading(false);
    }
  };

  const loadProducts = async (pageNum, limit, sku, location, name) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/product-availability?page=${pageNum}&limit=${limit}&sku=${sku}&location=${location}&name=${name}`
      );
      if (!res.ok) throw new Error("Failed to fetch products");

      const result = await res.json();
      const list = result.ProductAvailabilityList || [];

      let data = []

      if (list.length == 0) {
        const p_url = `https://inventory.dearsystems.com/ExternalApi/v2/product?Sku=${sku}&IncludeBOM=true`
        const response = await fetch(p_url, {
          headers: {
            "Content-Type": "application/json",
            "api-auth-accountid": API_AUTH_ACCOUNT_ID,
            "api-auth-applicationkey": API_AUTH_APPLICATION_KEY,
          },
          cache: "no-store",
        });

        const u_data = await response.json();
        data = u_data.Products;
      }

      const grouped = Object.values(
        list.reduce((acc, item) => {
          if (!acc[item.SKU]) {
            acc[item.SKU] = {
              ...item,
              Location: [item.Location],
              ProductID: item.ProductID || item.ID ,
            };
          } else {
            acc[item.SKU].OnHand += item.OnHand || 0;
            acc[item.SKU].Allocated += item.Allocated || 0;
            acc[item.SKU].Available += item.Available || 0;
            acc[item.SKU].OnOrder += item.OnOrder || 0;
            acc[item.SKU].StockOnHand += parseInt(item.StockOnHand) || 0;
            acc[item.SKU].InTransit += item.InTransit || 0;
            if (!acc[item.SKU].Location.includes(item.Location)) {
              acc[item.SKU].Location.push(item.Location);
            }
          }
          return acc;
        }, {})
      );

      const total =
        sku || name ? grouped.length : result.Total || grouped.length;

      (list.length == 0) ? setProducts(data) : setProducts(grouped);
      setTotalRecords(total);
    } catch (err) {
      console.error("Error loading products:", err);
      setProducts([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/location?page=1&limit=100");
      const result = await res.json();
      setLocations(result.LocationList || []);
    } catch (err) {
      console.error("Error loading locations:", err);
      setLocations([]);
    }
  };

  const parseYearMonth = (str) => {
    const [year, monthStr] = str.split("-");
    return new Date(`${monthStr} 1, ${year}`);
  };

  const getMonthlyDueInOutForSKU = (sku, location) => {
    const result = {};
    Object.entries(dueInOrders).forEach(([month, orders]) => {
      const inOrders = orders.filter(
        (order) => new Date(order.requireby) > new Date()
      );
      inOrders.forEach((order) => {
        order.orders.forEach((line) => {
          if (line.SKU === sku && order.Location === location) {
            const normalizedOrderLoc = normalizeLocation(order.Location);
            const normalizedSelectedLoc = normalizeLocation(location);
            const isMatching = normalizedOrderLoc === normalizedSelectedLoc;

            if (isMatching) {
              if (!result[month]) {
                result[month] = { dueIn: 0, dueOut: 0, refs: [] };
              }
              result[month].dueIn += line.Quantity;
              if (!result[month].refs.includes(order.orderNumber)) {
                result[month].refs.push(order.orderNumber);
              }
            }
          }
        });
      });
    });

    Object.entries(dueOutOrders).forEach(([month, orders]) => {
      const outOrders = orders.filter(
        (order) => new Date(order.shipby) > new Date()
      );
      outOrders.forEach((order) => {
        order.orders.forEach((line) => {
          if (line.SKU === sku && order.Location === location) {
            const normalizedOrderLoc = normalizeLocation(order.Location);
            const normalizedSelectedLoc = normalizeLocation(location);
            const isMatching = normalizedOrderLoc === normalizedSelectedLoc;

            if (isMatching) {
              if (!result[month]) {
                result[month] = { dueIn: 0, dueOut: 0, refs: [] };
              }
              result[month].dueOut += line.Quantity;
              if (!result[month].refs.includes(order.orderNumber)) {
                result[month].refs.push(order.orderNumber);
              }
            }
          }
        });
      });
    });

    let ots = 0;
    return Object.entries(result)
      .sort(([a], [b]) => parseYearMonth(a) - parseYearMonth(b))
      .map(([month, { dueIn, dueOut, refs }]) => {
        ots += dueIn - dueOut;
        return { month, dueIn, dueOut, ots, refs: refs || [] };
      });
  };

  const getTotalQuantityForSKU = (order, sku) => {
    let totalQuantity = 0;

    // Loop through all putAway objects and then each line to sum quantities
    for (const key in order.put_away) {
        const lines = order.put_away[key].Lines;
        for (const lineKey in lines) {
            if (lines[lineKey].SKU === sku) {
                totalQuantity += lines[lineKey].Quantity;
            }
        }
    }

    return totalQuantity;
  };


  const computeOTSForSKU = (sku, location, OnHand = 0, parentOTS = 0) => {
    const ComponentOnHand = OnHand;
    console.log(ComponentOnHand, "ComponentOnHand");
    const monthlyData = getMonthlyDueInOutForSKU(sku, location);
    const today = new Date();

    const pastDueIn = Object.values(dueInOrders)
      .flat()
      .filter(
        (order) =>
          new Date(order.requireby) < today &&
          normalizeLocation(order.Location) === normalizeLocation(location) &&
          order.orders.some((line) => line.SKU === sku)
      );

    const pastDueOut = Object.values(dueOutOrders)
      .flat()
      .filter(
        (order) =>
          new Date(order.shipby) < today &&
          normalizeLocation(order.Location) === normalizeLocation(location) &&
          order.orders.some((line) => line.SKU === sku)
      );


    const totalPastDueIn = pastDueIn.reduce((sum, order) => {
        let recieved = 0
        if (order.status == 'RECEIVING')
        {
          recieved = getTotalQuantityForSKU(order, sku);
        }

        return (
          sum +
          order.orders
            .filter((line) => line.SKU === sku)
            .reduce((s, line) => s + line.Quantity - recieved, 0)
        );
      }, 0);

    const totalPastDueOut = pastDueOut.reduce(
      (sum, order) =>
        sum +
        order.orders
          .filter((line) => line.SKU === sku)
          .reduce((s, line) => s + line.Quantity, 0),
      0
    );

    // Include parent OTS
    const sohOTS = ComponentOnHand + (parentOTS || 0);
    console.log(sohOTS, "SohOTSData");
    const sohEntry = {
      month: "SOH",
      dueIn: sohOTS,
      dueOut: "",
      ots: sohOTS,
      refs: [],
    };

    const dueEntry = {
      month: "Late Orders",
      dueIn: totalPastDueIn,
      dueOut: totalPastDueOut,
      ots: sohOTS + totalPastDueIn - totalPastDueOut,
      refs: [
        ...new Set([
          ...pastDueIn.map((o) => o.orderNumber),
          ...pastDueOut.map((o) => o.orderNumber),
        ]),
      ],
    };

    let currentOTS = dueEntry.ots;
    console.log(currentOTS, "currentOTS");
    let computedData = [];

    if (Array.isArray(monthlyData) && monthlyData.length > 0) {
      computedData = monthlyData.map((entry) => {
        const inQty = parseInt(entry.dueIn) || 0;
        const outQty = parseInt(entry.dueOut) || 0;
        currentOTS += inQty - outQty;
        return { ...entry, ots: currentOTS };
      });
    } else {
      // Fallback: show a current-month placeholder if no data
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${now.toLocaleString(
        "default",
        {
          month: "short",
        }
      )}`;
      computedData = [
        {
          month: currentMonthKey,
          dueIn: 0,
          dueOut: 0,
          ots: currentOTS,
        },
      ];
    }

    console.log("computeOTSForSKU result:", [
      sohEntry,
      dueEntry,
      ...computedData,
    ]);

    return [sohEntry, dueEntry, ...computedData];
  };

  const getOTS = (compOTS, currentMonthKey) => {
    let result = compOTS.find((item) => item.month === currentMonthKey);

    if (!result) {
      result = compOTS.find((item) => item.month === "Late Orders");
    }

    if (!result) {
      result = compOTS.find((item) => item.month === "SOH");
    }

    if (!result) {
      return 0;
    }

    return result.ots;
  };

  
  const handleSOHClick = async (sku, selectedLocation) => {

    try {
      setPopupLoading(true);
      setOpenPopup(true);
      setPopupData([]);
      setBomComponents([]);
      setBomLoading(true);

      const product = products.find((p) => p.SKU === sku);
      const OnHand = product?.OnHand ?? 0;

      const monthlyData = getMonthlyDueInOutForSKU(sku, selectedLocation);
      const today = new Date();

      const pastDueIn = Object.values(dueInOrders)
        .flat()
        .filter(
          (order) =>
            new Date(order.requireby) < today &&
            normalizeLocation(order.Location) ===
              normalizeLocation(selectedLocation) &&
            order.orders.some((line) => line.SKU === sku)
        );

      const pastDueOut = Object.values(dueOutOrders)
        .flat()
        .filter(
          (order) =>
            new Date(order.shipby) < today &&
            normalizeLocation(order.Location) ===
              normalizeLocation(selectedLocation) &&
            order.orders.some((line) => line.SKU === sku)
        );

      const totalPastDueIn = pastDueIn.reduce((sum, order) => {
        let recieved = 0
        if (order.status == 'RECEIVING')
        {
          recieved = getTotalQuantityForSKU(order, sku);
        }

        return (
          sum +
          order.orders
            .filter((line) => line.SKU === sku)
            .reduce((s, line) => s + line.Quantity - recieved, 0)
        );
      }, 0);

      const totalPastDueOut = pastDueOut.reduce((sum, order) => {
        return (
          sum +
          order.orders
            .filter((line) => line.SKU === sku)
            .reduce((s, line) => s + line.Quantity, 0)
        );
      }, 0);

      const sohEntry = {
        month: "SOH",
        dueIn: OnHand,
        dueOut: "",
        ots: OnHand,
        refs: [],
      };

      const lateRefs = [
        ...new Set([
          ...pastDueIn.map((order) => order.orderNumber),
          ...pastDueOut.map((order) => order.orderNumber),
        ]),
      ];

      const dueEntry = {
        month: "Late Orders",
        dueIn: totalPastDueIn,
        dueOut: totalPastDueOut,
        ots: OnHand + totalPastDueIn - totalPastDueOut,
        refs: lateRefs,
      };

      let currentOTS = dueEntry.ots;
      const computedData = monthlyData.map((entry) => {
        const inQty = Number(entry.dueIn) || 0;
        const outQty = Number(entry.dueOut) || 0;
        currentOTS += inQty - outQty;
        // currentOTS = Math.max(, currentOTS);
        return { ...entry, ots: currentOTS };
      });
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${now.toLocaleString(
        "default",
        {
          month: "short",
        }
      )}`;
      const currentMonthEntry = computedData.find(
        (entry) => entry.month === currentMonthKey
      );
      const currentMonthOTS = currentMonthEntry?.ots ?? dueEntry.ots;

      setPopupData([sohEntry, dueEntry, ...computedData]);
      setPopupData([sohEntry, dueEntry, ...computedData]);

      const dearProductId = product?.ProductID || product?.ID;
      if (dearProductId) {
        const bomRes = await fetch(
          `/api/product?id=${dearProductId}&IncludeBOM=true`
        );
        if (!bomRes.ok) throw new Error("Failed to fetch BOM components");

        const bomData = await bomRes.json();
        const bomList = bomData?.Products?.[0]?.BillOfMaterialsProducts || [];
        const enrichedData = [];

        if (bomList.length > 0) {
          const bomComponents = await Promise.all(
            bomList.map(async (comp) => {
              try {
                const ress = await fetch(
                  `/api/product-availability?page=1&limit=50&sku=${comp.ProductCode}&location=${selectedLocation}`
                );
                if (!ress.ok) {
                  console.warn(
                    `Failed to fetch availability for ${comp.ProductCode}`
                  );
                  return null;
                }

                const results = await ress.json();
                const list = results?.ProductAvailabilityList || [];

                const totalAvailable = list.reduce(
                  (sum, item) => sum + (item.Available ?? 0),
                  0
                );
                const totalIncoming = list.reduce(
                  (sum, item) => sum + (item.OnOrder ?? 0),
                  0
                );

                const e_onhand = list.reduce(
                  (sum, item) => sum + (item.OnHand ?? 0),
                  0
                );

                const now = new Date();
                const currentMonthKey = `${now.getFullYear()}-${now.toLocaleString(
                  "default",
                  {
                    month: "short",
                  }
                )}`;
                console.log(currentMonthKey, "currentMonthKey");
                const currentMonthEntry = computedData.find(
                  (entry) => entry.month === currentMonthKey
                );
                const c_curentMonthOTS = currentMonthEntry?.ots ?? dueEntry.ots;

                const compOTS = computeOTSForSKU(
                  comp.ProductCode,
                  selectedLocation,
                  e_onhand,
                  currentMonthOTS || 0
                );

                enrichedData.push({ sku: comp.ProductCode, data: compOTS });

                let componentMonthOts = 0;
                try {
                  const comMonthData = getMonthlyDueInOutForSKU(
                    comp.ProductCode,
                    selectedLocation
                  );
                  console.log(comMonthData, "comMothData");
                  if (comMonthData) {
                    comMonthData.sort((a, b) => {
                      const [aYear, aMonth] = a.month.split("-");
                      const [bYear, bMonth] = b.month.split("-");
                      return (
                        new Date(`${aYear}-${aMonth}-01`) -
                        new Date(`${bYear}-${bMonth}-01`)
                      );
                    });
                    console.log(comMonthData, "comMonthData");
                    let compCurrentOts = totalIncoming;
                    const compComputed = comMonthData.map((entry) => {
                      const inQty = Number(entry.dueIn) || 0;
                      const outQty = Number(entry.dueOut) || 0;

                      const Ots = compCurrentOts + inQty - outQty;
                      compCurrentOts = Ots;
                      return { ...entry, Ots };
                    });
                    console.log(compCurrentOts, "compCurrentOts");
                    const compMonthEntry = compComputed.find(
                      (entry) => entry.month === currentMonthKey
                    );
                    console.log(compMonthEntry, "compMonthEntry");
                    if (compMonthEntry) {
                      componentMonthOts = compMonthEntry.ots;
                    } else {
                      componentMonthOts = Math.max(dueEntry.ots);
                    }

                    // componentMonthOts =
                    //   compMonthEntry?.ots !== undefined ? compMonthEntry.ots : Math.max(dueEntry.ots)
                  } else {
                    componentMonthOts = Math.max(0, dueEntry.ots);
                  }
                  console.log(componentMonthOts, "component");
                } catch (e) {
                  console.warn(
                    "Cannot compute monthly OTS for",
                    comp.ProductCode
                  );
                  componentMonthOts = dueEntry.ots;
                }

                console.log(
                  comp.ProductCode,
                  "componentMonthOts:",
                  componentMonthOts
                );

                return {
                  sku: list[0]?.SKU || comp.ProductCode,
                  name: list[0]?.Name || comp.Name,
                  bom_qty: comp.Quantity,
                  avail: (c_curentMonthOTS ?? dueEntry.ots) + totalAvailable,
                  incoming: getOTS(compOTS,currentMonthKey),
                };
              } catch (innerErr) {
                console.error(
                  `Error fetching component ${comp.ProductCode}:`,
                  innerErr
                );
                return null;
              }
            })
          );

          const validComponents = bomComponents.filter(Boolean);
          // --- Compute OTS breakdown for each component ---
          const enrichedComponents = validComponents.map((comp) => {
            // const compOTS = computeOTSForSKU(
            //   comp.sku,
            //   selectedLocation,
            //   comp.OnHand,
            //   currentMonthOTS || 0
            // );
            return {
              ...comp,
              otsData: enrichedData.find((item) => item.sku === comp.sku).data,
            };
          });

          console.log(enrichedComponents, "enrichedComponents");

          setBomComponents(enrichedComponents);
        } else {
          setBomComponents([]);
        }
      } else {
        console.warn("No ProductID found for this SKU:", sku);
        setBomComponents([]);
      }
    } catch (err) {
      console.error("Error fetching SOH/BOM data:", err);
      setPopupData([]);
      setBomComponents([]);
    } finally {
      setPopupLoading(false);
      setBomLoading(false);
    }
  };

  useEffect(() => {
    loadDueInOrders();
    loadDueOutOrders();
    loadLocations();
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadProducts(
        page + 1,
        rowsPerPage,
        skuSearch,
        selectedLocation,
        nameSearch
      );
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [page, rowsPerPage, skuSearch, selectedLocation, nameSearch]);

  const handlePageChange = (_, newPage) => setPage(newPage);
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(+e.target.value);
    setPage(0);
  };


  const renderSkeletonRows = (count = 10) =>
    Array.from({ length: count }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: 8 }).map((_, j) => (
          <TableCell key={j}>
            <Skeleton variant="text" width="80%" />
          </TableCell>
        ))}
      </TableRow>
    ));

  return (
    <Paper
      sx={{
        m: 2,
        p: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Box display="flex" gap={2} mb={2} width="100%" flexWrap="wrap">
        <TextField
          label="Search by SKU"
          variant="outlined"
          value={skuSearch}
          onChange={(e) => setSkuSearch(e.target.value)}
        />
        <TextField
          label="Search by Name"
          variant="outlined"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
        />
        <Autocomplete
          sx={{ width: "30%" }}
          options={locationOptions}
          getOptionLabel={(option) => option.Name}
          value={
            locationOptions.find((loc) => loc.Name === selectedLocation) || null
          }
          onChange={(_, val) => setSelectedLocation(val?.Name || "")}
          renderInput={(params) => (
            <TextField {...params} label="Select Location" />
          )}
        />

        {/* <Button
          variant="contained"
          
          onClick={loadDueInOrders}
          disabled={dueInLoading}
        >
          {dueInLoading ? "Refreshing..." : "Refresh Due In"}
        </Button>
        <Button
          variant="contained"
          onClick={loadDueOutOrders}
          disabled={dueOutLoading}
        >
          {dueOutLoading ? "Refreshing..." : "Refresh Due Out"}
        </Button> */}
      </Box>

      <TableContainer sx={{ flex: 1 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>On Hand</TableCell>
              <TableCell>Allocated</TableCell>
              <TableCell>Available</TableCell>
              <TableCell>On Order</TableCell>
              <TableCell></TableCell>
              <TableCell>In Transit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              renderSkeletonRows(15)
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              products.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item?.SKU}</TableCell>
                  <TableCell>{item?.Name}</TableCell>
                  <TableCell>{item?.OnHand ?? 0}</TableCell>
                  <TableCell>{item?.Allocated ?? 0}</TableCell>
                  <TableCell>{item?.Available ?? 0}</TableCell>
                  <TableCell>{item?.OnOrder ?? 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleSOHClick(item.SKU, selectedLocation)}
                      sx={{
                        padding: 0,
                        minWidth: "auto",
                        textTransform: "none",
                      }}
                    >
                      View OTS
                    </Button>
                  </TableCell>
                  <TableCell>{item.InTransit ?? 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalRecords}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[50, 100, 200]}
      />

      <Dialog
        open={openPopup}
        onClose={() => setOpenPopup(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Open To Sell (OTS)</DialogTitle>
        <DialogContent dividers>
          {popupLoading ? (
            <Box>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} display="flex" gap={2} mb={1}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} variant="text" width="20%" />
                  ))}
                </Box>
              ))}
            </Box>
          ) : popupData.length > 0 ? (
            <>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ref</TableCell>
                      <TableCell>Month</TableCell>
                      <TableCell>In</TableCell>
                      <TableCell>Out</TableCell>
                      <TableCell>Open to Sell</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {popupData.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {entry.refs && entry.refs.length > 0
                            ? entry.refs.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>{entry.month}</TableCell>
                        <TableCell>{entry.dueIn}</TableCell>
                        <TableCell>{entry.dueOut}</TableCell>
                        <TableCell>{entry.ots}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {bomLoading ? (
                <Box mt={2}>
                  <Typography variant="subtitle1">
                    Loading components...
                  </Typography>
                  <CircularProgress size={20} sx={{ ml: 1 }} />
                </Box>
              ) : bomComponents.length > 0 ? (
                <>
                  <Typography variant="h6" sx={{ mt: 5, mb: 1 }}>
                    Virtual Stock
                  </Typography>

                  <TableContainer component={Paper}>
                    <Table size="small" style={{ border: "1px solid black" }}>
                      <TableHead>
                        <TableRow style={{ border: "1px solid black" }}>
                          <TableCell style={{ border: "1px solid black" }}>
                            Product
                          </TableCell>
                          <TableCell style={{ border: "1px solid black" }}>
                            SKU
                          </TableCell>
                          <TableCell style={{ border: "1px solid black" }}>
                            BOM Qty
                          </TableCell>
                          {/* <TableCell align="right" style={{border:"1px solid black"}}>SOH</TableCell> */}
                          <TableCell
                            align="right"
                            style={{ border: "1px solid black" }}
                          >
                            SOH
                          </TableCell>
                          <TableCell
                            align="right"
                            style={{ border: "1px solid black" }}
                          >
                            Available This Month
                          </TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {bomComponents.map((comp, idx) => (
                          <TableRow key={idx}>
                            <TableCell style={{ border: "1px solid black" }}>
                              {comp.name}
                            </TableCell>
                            <TableCell style={{ border: "1px solid black" }}>
                              {comp.sku}
                            </TableCell>
                            <TableCell
                              align="center"
                              style={{ border: "1px solid black" }}
                            >
                              {comp.bom_qty}
                            </TableCell>
                            {/* <TableCell align="right" style={{border:"1px solid black"}}>{comp.soh}</TableCell> */}
                            <TableCell
                              align="center"
                              style={{ border: "1px solid black" }}
                            >
                              {comp.avail}
                            </TableCell>
                            <TableCell
                              align="center"
                              style={{ border: "1px solid black" }}
                            >
                              {comp.incoming}
                            </TableCell>
                          </TableRow>
                        ))}

                        <TableRow>
                          <TableCell
                            colSpan={3}
                            align="right"
                            style={{ border: "1px solid black" }}
                          >
                            <strong>Can Make</strong>
                          </TableCell>
                          <TableCell
                            align="center"
                            style={{ border: "1px solid black" }}
                          >
                            {bomComponents.length
                              ? Math.min(
                                  ...bomComponents.map((comp) =>
                                    Math.max(comp.avail ?? 0)
                                  )
                                )
                              : 0}
                          </TableCell>
                          <TableCell
                            align="center"
                            style={{ border: "1px solid black" }}
                          >
                            {bomComponents.length
                              ? Math.min(
                                  ...bomComponents.map((comp) =>
                                    Math.max(comp.incoming ?? 0, 0)
                                  )
                                )
                              : 0}
                          </TableCell>
                          {/* <TableCell align="right" style={{border:"1px solid black"}}>-</TableCell> */}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {bomComponents.map((comp, idx) => (
                    <Box key={idx} mt={4}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        OTS for Component: {comp.name} ({comp.sku})
                      </Typography>
                      <TableContainer component={Paper}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Ref</TableCell>
                              <TableCell>Month</TableCell>
                              <TableCell>In</TableCell>
                              <TableCell>Out</TableCell>
                              <TableCell>Open to Sell</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {comp.otsData?.map((entry, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  {entry.refs?.length
                                    ? entry.refs.join(", ")
                                    : "-"}
                                </TableCell>
                                <TableCell>{entry.month}</TableCell>
                                <TableCell>{entry.dueIn}</TableCell>
                                <TableCell>{entry.dueOut}</TableCell>
                                <TableCell>{entry.ots}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </>
              ) : ""}
            </>
          ) : (
            <Typography>No OTS data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPopup(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
