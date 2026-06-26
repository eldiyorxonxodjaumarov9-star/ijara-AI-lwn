"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CrmHeader, CrmSidebar } from "@/components/arenda-crm/crm-shell";
import { CrmDashboardView } from "@/components/arenda-crm/views/crm-dashboard-view";
import {
  CrmAdsView,
  CrmBookingsView,
  CrmClientsView,
  CrmMessagesView,
  CrmPaymentsView,
  CrmPropertiesView,
  CrmReportsView,
  CrmVerificationView,
} from "@/components/arenda-crm/views/crm-module-views";
import {
  CrmAiCenterView,
  CrmCommunicationView,
  CrmPackagesView,
  CrmRegionsView,
  CrmSettingsView,
} from "@/components/arenda-crm/views/crm-extra-views";
import { CRM_NAV, type CrmViewId } from "@/lib/arenda-crm/constants";
import { getAllowedCrmModules } from "@/lib/landlord-access";
import type { LandlordProfile } from "@/lib/landlord-profile";

export function ArendaCrmApp({
  profile,
  onLogout,
  onProfileUpdate,
}: {
  profile: LandlordProfile;
  onLogout: () => void;
  onProfileUpdate: (p: LandlordProfile) => void;
}) {
  const [active, setActive] = useState<CrmViewId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allowedModules = useMemo(
    () => getAllowedCrmModules(profile.login),
    [profile.login]
  );

  useEffect(() => {
    if (allowedModules.length && !allowedModules.includes(active)) {
      setActive(allowedModules[0]);
    }
  }, [allowedModules, active]);

  const safeActive = allowedModules.includes(active)
    ? active
    : allowedModules[0] ?? "dashboard";

  const activeLabel = useMemo(
    () => CRM_NAV.find((n) => n.id === safeActive)?.label ?? "Boshqaruv paneli",
    [safeActive]
  );

  const renderView = () => {
    if (!allowedModules.includes(safeActive)) {
      return (
        <div className="rounded-xl border p-8 text-center text-slate-500">
          Bu bo&apos;limga kirish huquqingiz yo&apos;q. Admin bilan bog&apos;laning.
        </div>
      );
    }
    switch (safeActive) {
      case "dashboard":
        return <CrmDashboardView profile={profile} />;
      case "properties":
        return <CrmPropertiesView />;
      case "clients":
        return <CrmClientsView />;
      case "bookings":
        return <CrmBookingsView />;
      case "ads":
        return <CrmAdsView />;
      case "payments":
        return <CrmPaymentsView />;
      case "ai":
        return <CrmAiCenterView />;
      case "messages":
        return <CrmMessagesView />;
      case "verification":
        return <CrmVerificationView />;
      case "communication":
        return <CrmCommunicationView />;
      case "regions":
        return <CrmRegionsView />;
      case "packages":
        return <CrmPackagesView />;
      case "reports":
        return <CrmReportsView />;
      case "settings":
        return <CrmSettingsView profile={profile} onProfileUpdate={onProfileUpdate} />;
      default:
        return <CrmDashboardView profile={profile} />;
    }
  };

  return (
    <div className="arenda-crm flex min-h-screen bg-slate-50 text-[#0F172A] dark:bg-[#060d18] dark:text-white">
      <CrmSidebar
        active={safeActive}
        onNavigate={(id) => {
          if (getAllowedCrmModules(profile.login).includes(id)) {
            setActive(id);
          }
        }}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        profile={profile}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CrmHeader
          activeLabel={activeLabel}
          onMenuOpen={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          collapsed={collapsed}
          onLogout={onLogout}
          profile={profile}
          search={search}
          onSearchChange={setSearch}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={safeActive}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
