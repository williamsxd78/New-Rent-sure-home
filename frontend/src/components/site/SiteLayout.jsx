import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import SupportWidget from "./SupportWidget";

export default function SiteLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <SupportWidget />
    </div>
  );
}
