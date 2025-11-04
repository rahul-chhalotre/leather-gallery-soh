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

// const normalizeLocation = (loc) => loc.replace(/\s+/g, "").toLowerCase();
const normalizeLocation = (loc) =>
  loc?.toLowerCase().replace(/\s+/g, "") || "";

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

  const [dueInOrders, setDueInOrders] = useState([]);
  const [dueInLoading, setDueInLoading] = useState(false);
  const [dueOutOrders, setDueOutOrders] = useState([]);
  const [dueOutLoading, setDueOutLoading] = useState(false);

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

// const purchaseCache = useRef({});
// const salesCache = useRef({});
// const productCache = useRef({});

const loadDueInOrders = async () => {
  // const cacheKey = `${pageNum}-${limit}-${location}`;
  // const cacheKey=`all-purchase-orders`;
  // if (purchaseCache.current[cacheKey]) {
  //   setDueInOrders(purchaseCache.current[cacheKey]);
  //   return;
  // }

  setDueInLoading(true);
  try {
    const res = await fetch(
      `/api/purchase_orders?OrderStatus=AUTHORISED&RestockReceivedStatus=DRAFT`
    );
    if (!res.ok) throw new Error("Failed to fetch due-in orders");
    const data = await res.json();
    console.log("All Purchase Data",data)
    const allOrders = data.purchaseOrders || [];

    const getYearMonth = (dateString) => {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${date.toLocaleString("default", { month: "short" })}`;
    };

    const groupedOrders = allOrders.reduce((acc, order) => {
      if (!order.RequiredBy) return acc;
      const month = getYearMonth(order.RequiredBy);
      
      acc[month] = acc[month] || [];
      acc[month].push({
        Location: (order.Location),
        requireby: order.RequiredBy,
        orderNumber: order.OrderNumber,
        orders: order.Order.Lines.map((line) => ({
            SKU: line.SKU,
            Quantity: line.Quantity,
          })),
      });
      return acc;
    }, {});

    // purchaseCache.current[cacheKey] = groupedOrders; 
    setDueInOrders(groupedOrders);
  } catch (err) {
    console.error("Error fetching due-in orders:", err);
  } finally {
    setDueInLoading(false);
  }
};

const loadDueOutOrders = async () => {
  // // const cacheKey = `${pageNum}-${limit}`;
  // const cacheKey = `all-sale0-orders`;
  // if (salesCache.current[cacheKey]) {
  //   setDueOutOrders(salesCache.current[cacheKey]);
  //   return;
  // }

  setDueOutLoading(true);
  try {
    const res = await fetch(
      `/api/sale_orders?OrderStatus=AUTHORISED&FulfilmentStatus=NOTFULFILLED`
    );
    if (!res.ok) throw new Error("Failed to fetch due-out orders");
    const data = await res.json();
    console.log("all sales data",data)
    const allOrders = data.saleOrders || [];
    

    const getYearMonth = (dateString) => {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${date.toLocaleString("default", { month: "short" })}`;
    };

    const groupedOrders = allOrders.reduce((acc, order) => {
      if (!order.ShipBy) return acc;
      const month = getYearMonth(order.ShipBy);
      acc[month] = acc[month] || [];
      acc[month].push({
        Location: (order.Location),
        shipby: order.ShipBy,
        orderNumber: order.Order.SaleOrderNumber,
        orders: order.Order.Lines.map((line) => ({
            SKU: line.SKU,
            Quantity: line.Quantity,
          })),
      });
      return acc;
    }, {});

    // salesCache.current[cacheKey] = groupedOrders; 
    setDueOutOrders(groupedOrders);
  } catch (err) {
    console.error("Error fetching due-out orders:", err);
  } finally {
    setDueOutLoading(false);
  }
};

const loadProducts = async (pageNum, limit, sku, location, name) => {
  // const cacheKey = `${pageNum}-${limit}-${sku}-${location}-${name}`;
  // if (productCache.current[cacheKey]) {
  //   const cached = productCache.current[cacheKey];
  //   setProducts(cached.products);
  //   setTotalRecords(cached.total);
  //   return;
  // }

  setLoading(true);
  try {
    const res = await fetch(
      `/api/product-availability?page=${pageNum}&limit=${limit}&sku=${sku}&location=${location}&name=${name}`
    );
    if (!res.ok) throw new Error("Failed to fetch products");

    const result = await res.json();
    const list = result.ProductAvailabilityList || [];

    const grouped = Object.values(
      list.reduce((acc, item) => {
        if (!acc[item.SKU])
          acc[item.SKU] = { ...item, Location: [item.Location] };
        else {
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

    const total = sku || name ? grouped.length : result.Total || grouped.length;
    // productCache.current[cacheKey] = { products: grouped, total }; 
    setProducts(grouped);
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
    console.log("Processing SKU:", sku, "at location:", location);
    
    const result = {};
    Object.entries(dueInOrders).forEach(([month, orders]) => {
      console.log("Checking dueIn month:", month);
      const inOrders = orders.filter(
        (order) => new Date(order.requireby) > new Date()
      );

      inOrders.forEach((order) => {
        console.log("Order RequireBy:", order.requireby, "Location:", order.Location);

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
        console.log("Order RequireBy:", order.shipby, "Location:", order.Location);
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
        return {
          month,
          dueIn,
          dueOut,
          ots,
          refs: refs || [],
        };
      });
  };

 const handleSOHClick = async (sku, selectedLocation) => {
  console.log("Clicked SKU:", sku, "selected location:", selectedLocation);

    try {
  setPopupLoading(true);
  setPopupData([]);
  setOpenPopup(true);

    const product = products.find((p) => p.SKU === sku);
    const OnHand = product?.OnHand ?? 0;

    const monthlyData = getMonthlyDueInOutForSKU(sku, selectedLocation);

    const today = new Date();

    const pastDueIn = Object.values(dueInOrders)
      .flat()
      .filter(
        (order) =>
          new Date(order.requireby) < today &&
          normalizeLocation(order.Location) === normalizeLocation(selectedLocation) &&
          order.orders.some((line) => line.SKU === sku)
      );

    const pastDueOut = Object.values(dueOutOrders)
      .flat()
      .filter(
        (order) =>
          new Date(order.shipby) < today &&
            order.Location === selectedLocation &&
          order.orders.some((line) => line.SKU === sku)
      );

    const totalPastDueIn = pastDueIn.reduce((sum, order) => {
      return (
        sum +
        order.orders
          .filter((line) => line.SKU === sku)
          .reduce((s, line) => s + line.Quantity, 0)
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
      const inQty = parseInt(entry.dueIn) || 0;
      const outQty = parseInt(entry.dueOut) || 0;
      currentOTS += inQty - outQty;

        return {
          ...entry,
          ots: currentOTS,
        };
    });

      console.log("Final popupData:", [sohEntry, dueEntry, ...computedData]);
    setPopupData([sohEntry, dueEntry, ...computedData]);
  } catch (err) {
      console.error("Error fetching SOH popup data:", err);
      setPopupData([]);
  } finally {
    setPopupLoading(false);
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
      {/* Filters */}
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
                  <TableCell>{item.SKU}</TableCell>
                  <TableCell>{item.Name}</TableCell>
                  <TableCell>{item.OnHand}</TableCell>
                  <TableCell>{item.Allocated}</TableCell>
                  <TableCell>{item.Available}</TableCell>
                  <TableCell>{item.OnOrder}</TableCell>
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

                  <TableCell>{item.InTransit}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalRecords}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[50, 100, 200]}
      />

      {/* SOH / OTS Popup */}
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
