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

  const searchTimeout = useRef(null);

  const loadDueInOrders = async () => {
    setDueInLoading(true);
    try {
      const res = await fetch(
        `/api/purchase_orders?OrderStatus=AUTHORISED&RestockReceivedStatus=DRAFT`
      );
      if (!res.ok) throw new Error("Failed to fetch due-in orders");
      const data = await res.json();
      const allOrders = data.purchaseOrders || [];

      const getYearMonth = (dateString) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = date.toLocaleString("default", { month: "short" });
        return `${year}-${month}`;
      };

      const groupedOrders = allOrders.reduce((acc, order) => {
        if (!order.RequiredBy) return acc;
        const month = getYearMonth(order.RequiredBy);
        if (!acc[month]) acc[month] = [];

        acc[month].push({
          Location: order.Location,
          orderNumber: order.OrderNumber,
          orders: order.Order.Lines.map((line) => ({
            SKU: line.SKU,
            Quantity: line.Quantity,
          })),
        });

        return acc;
      }, {});

      setDueInOrders(groupedOrders);
    } catch (err) {
      console.error("Error fetching due-in orders:", err);
      setDueInOrders({});
    } finally {
      setDueInLoading(false);
    }
  };

  const loadDueOutOrders = async () => {
    setDueOutLoading(true);
    try {
      const res = await fetch(
        `/api/sale_orders?OrderStatus=AUTHORISED&FulfilmentStatus=NOT FULFILLED`
      );
      if (!res.ok) throw new Error("Failed to fetch due-out orders");

      const data = await res.json();
      const allOrders = data.saleOrders || [];

      const getYearMonth = (dateString) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = date.toLocaleString("default", { month: "short" });
        return `${year}-${month}`;
      };

      const groupedOrders = allOrders.reduce((acc, order) => {
        if (!order.ShipBy) return acc;
        const month = getYearMonth(order.ShipBy);
        if (!acc[month]) acc[month] = [];

        acc[month].push({
          Location: order.Location,
          orderNumber: order.Order.SaleOrderNumber,
          orders: order.Order.Lines.map((line) => ({
            SKU: line.SKU,
            Quantity: line.Quantity,
          })),
        });

        return acc;
      }, {});

      setDueOutOrders(groupedOrders);
    } catch (err) {
      console.error("Error fetching due-out orders:", err);
      setDueOutOrders({});
    } finally {
      setDueOutLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/location?page=1&limit=1000");
      const result = await res.json();
      setLocations(result.LocationList || []);
    } catch (err) {
      console.error("Error loading locations:", err);
      setLocations([]);
    }
  };

  const loadProducts = async (pageNum, limit, sku, location, name) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/product-availability?page=${pageNum}&limit=${limit}&sku=${sku}&location=${location}&name=${name}`
      );
      const result = await res.json();
      const list = result.ProductAvailabilityList || [];

      const grouped = Object.values(
        list.reduce((acc, item) => {
          if (!acc[item.SKU]) acc[item.SKU] = { ...item };
          else {
            acc[item.SKU].OnHand += item.OnHand || 0;
            acc[item.SKU].Allocated += item.Allocated || 0;
            acc[item.SKU].Available += item.Available || 0;
            acc[item.SKU].OnOrder += item.OnOrder || 0;
            acc[item.SKU].StockOnHand += parseInt(item.StockOnHand) || 0;
            acc[item.SKU].InTransit += item.InTransit || 0;
            acc[item.SKU].Location += `, ${item.Location}`;
          }
          return acc;
        }, {})
      );
      setProducts(grouped);
      setTotalRecords(result.Total || grouped.length);
    } catch (err) {
      console.error("Error loading products:", err);
      setProducts([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const parseYearMonth = (str) => {
    const [year, monthStr] = str.split("-");
    return new Date(`${monthStr} 1, ${year}`);
  };

  const getMonthlyDueInOutForSKU = (sku) => {
    const result = {};

    Object.entries(dueInOrders).forEach(([month, orders]) => {
      orders.forEach((order) => {
        order.orders.forEach((line) => {
          if (line.SKU === sku) {
            if (!result[month]) {
              result[month] = { dueIn: 0, dueOut: 0, refs: [] };
            }
            result[month].dueIn += line.Quantity;
            if (!result[month].refs.includes(order.orderNumber)) {
              result[month].refs.push(order.orderNumber);
            }
          }
        });
      });
    });

    Object.entries(dueOutOrders).forEach(([month, orders]) => {
      orders.forEach((order) => {
        order.orders.forEach((line) => {
          if (line.SKU === sku) {
            if (!result[month]) {
              result[month] = { dueIn: 0, dueOut: 0, refs: [] };
            }
            result[month].dueOut += line.Quantity;
            if (!result[month].refs.includes(order.orderNumber)) {
              result[month].refs.push(order.orderNumber);
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

  const handleSOHClick = async (sku, location) => {
    try {
      setPopupLoading(true);
      setOpenPopup(true);

      const product = products.find((p) => p.SKU === sku);
      const onHand = product?.OnHand ?? 0;

      const monthlyData = getMonthlyDueInOutForSKU(sku);

      let currentOTS = onHand;
      const computedData = monthlyData.map((entry) => {
        const { dueIn, dueOut } = entry;
        const inQty = parseInt(dueIn) || 0;
        const outQty = parseInt(dueOut) || 0;
        currentOTS = currentOTS + inQty - outQty;

        return {
          ...entry,
          ots: currentOTS,
        };
      });

      const sohEntry = {
        month: "SOH",
        dueIn: onHand,
        dueOut: "",
        ots: onHand,
        refs: [],
      };

      setPopupData([sohEntry, ...computedData]);
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
          options={[
            { Name: "Riverhorse Valley-Warehouse" },
            { Name: "Deco Park Warehouse" },
          ]}
          getOptionLabel={(opt) => opt.Name}
          value={
            [
              { Name: "Riverhorse Valley-Warehouse" },
              { Name: "Deco Park Warehouse" },
            ].find((loc) => loc.Name === selectedLocation) || null
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
                      onClick={() => handleSOHClick(item.SKU, item.Location)}
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
                    <TableCell>OTS</TableCell>
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
