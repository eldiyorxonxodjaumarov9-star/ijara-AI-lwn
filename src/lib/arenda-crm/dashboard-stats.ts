import { getCrmReports, getLandlordListings } from "@/lib/landlord-crm";
import { getLandlordProfile } from "@/lib/landlord-profile";
import { getListingMessagesForLandlord, getGlobalInquiriesForLandlord } from "@/lib/rental-inquiries";
import { formatUzs } from "@/lib/rental-search";

export function getArendaCrmDashboardStats(landlordEmail?: string) {
  const email =
    landlordEmail?.trim().toLowerCase() ||
    getLandlordProfile()?.email?.trim().toLowerCase() ||
    "";

  const reports = getCrmReports(email || undefined);
  const listings = email ? getLandlordListings(email) : getLandlordListings();
  const messages = getListingMessagesForLandlord(email || undefined);
  const leads = getGlobalInquiriesForLandlord(email || undefined);

  const maintenance = listings.filter((l) => l.status === "draft").length;
  const booked = reports.rentedListings;
  const active = reports.activeListings;
  const archived = 0;

  const monthlyRevenue = reports.monthlyPotential;
  const dailyRevenue = Math.round(monthlyRevenue / 30);

  const revenueChart = [
    { month: "Yan", daromad: monthlyRevenue * 0.7, xarajat: monthlyRevenue * 0.15 },
    { month: "Fev", daromad: monthlyRevenue * 0.75, xarajat: monthlyRevenue * 0.18 },
    { month: "Mar", daromad: monthlyRevenue * 0.82, xarajat: monthlyRevenue * 0.16 },
    { month: "Apr", daromad: monthlyRevenue * 0.88, xarajat: monthlyRevenue * 0.2 },
    { month: "May", daromad: monthlyRevenue * 0.92, xarajat: monthlyRevenue * 0.19 },
    { month: "Iyn", daromad: monthlyRevenue, xarajat: monthlyRevenue * 0.17 },
  ];

  const propertyPerformance = listings.slice(0, 5).map((l) => ({
    name: l.title.length > 18 ? `${l.title.slice(0, 18)}…` : l.title,
    views: Math.floor(40 + l.price / 500_000),
    leads: Math.floor(2 + l.area / 30),
  }));

  const regionalData = listings.reduce<Record<string, number>>((acc, l) => {
    const key = l.district || "Boshqa";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const regionChart = Object.entries(regionalData)
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const leadFunnel = [
    { stage: "Yangi", count: leads.length + reports.totalClients },
    { stage: "Bog'lanildi", count: Math.max(0, reports.totalClients - 2) },
    { stage: "Muzokara", count: Math.max(0, Math.floor(reports.totalClients * 0.6)) },
    { stage: "Shartnoma", count: booked },
    { stage: "Yopildi", count: Math.max(0, booked - 1) },
  ];

  return {
    totalProperties: reports.totalListings,
    activeProperties: active,
    bookedProperties: booked,
    maintenanceProperties: maintenance,
    archivedProperties: archived,
    totalClients: reports.totalClients,
    activeRentals: booked,
    monthlyRevenue,
    dailyRevenue,
    newLeads: leads.length,
    totalAds: active,
    adImpressions: active * 1240 + messages.length * 85,
    adClicks: active * 48 + messages.length * 12,
    aiRecommendations: Math.max(3, active + 2),
    messagesCount: messages.length,
    formatted: {
      monthlyRevenue: formatUzs(monthlyRevenue),
      dailyRevenue: formatUzs(dailyRevenue),
    },
    revenueChart,
    propertyPerformance,
    regionChart,
    leadFunnel,
  };
}
