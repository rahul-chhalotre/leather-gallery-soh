
"use client";
import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

const Header = () => {
  return (
    <AppBar position="static" sx={{backgroundColor:"#1D1616"}}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{color:"#EEEEEE",height:'40px'}}>
          Leather Gallery SOH
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
