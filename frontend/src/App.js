import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import ScrollToTop from "@/components/site/ScrollToTop";

import HomePage from "@/pages/HomePage";
import PropertiesPage from "@/pages/PropertiesPage";
import PropertyDetailsPage from "@/pages/PropertyDetailsPage";
import ApplyPage from "@/pages/ApplyPage";
import TrackingPage from "@/pages/TrackingPage";
import HowItWorksPage from "@/pages/HowItWorksPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import ReviewsPage from "@/pages/ReviewsPage";
import PolicyPage from "@/pages/PolicyPage";
import PaymentReturnPage from "@/pages/PaymentReturnPage";
import PaymentCancelPage from "@/pages/PaymentCancelPage";

import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminPropertiesPage from "@/pages/admin/AdminPropertiesPage";
import AdminApplicationsPage from "@/pages/admin/AdminApplicationsPage";
import AdminPaymentsPage from "@/pages/admin/AdminPaymentsPage";
import AdminReviewsPage from "@/pages/admin/AdminReviewsPage";
import AdminRefundsPage from "@/pages/admin/AdminRefundsPage";
import AdminAuditPage from "@/pages/admin/AdminAuditPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";

const POLICIES = [
  "privacy", "terms", "refund", "application-fee", "fair-housing",
  "screening-disclosure", "fcra", "e-signature", "data-retention",
];

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/:id" element={<PropertyDetailsPage />} />
            <Route path="/apply/:propertyId" element={<ApplyPage />} />
            <Route path="/track" element={<TrackingPage />} />
            <Route path="/payment/return" element={<PaymentReturnPage />} />
            <Route path="/payment/cancel" element={<PaymentCancelPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            {POLICIES.map((slug) => (
              <Route key={slug} path={`/policies/${slug}`} element={<PolicyPage slug={slug} />} />
            ))}

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="properties" element={<AdminPropertiesPage />} />
              <Route path="applications" element={<AdminApplicationsPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="reviews" element={<AdminReviewsPage />} />
              <Route path="refunds" element={<AdminRefundsPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Routes>
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
