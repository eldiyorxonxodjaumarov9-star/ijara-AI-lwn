"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CrmGlassCard } from "@/components/arenda-crm/crm-ui";
import { LandlordListingsTab } from "@/components/landing/landlord/landlord-listings-tab";
import { LandlordClientsTab } from "@/components/landing/landlord/landlord-clients-tab";
import { LandlordMessagesTab } from "@/components/landing/landlord/landlord-messages-tab";
import { LandlordReportsTab } from "@/components/landing/landlord/landlord-reports-tab";
import { LandlordVerifyTab } from "@/components/landing/landlord/landlord-verify-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLIENT_PIPELINE,
  PROPERTY_CATEGORIES,
} from "@/lib/arenda-crm/constants";
import {
  deleteCrmBooking,
  getCrmBookings,
  saveCrmBooking,
  type BookingStatus,
  type CrmBooking,
} from "@/lib/arenda-crm/bookings";
import { formatUzs } from "@/lib/rental-search";
import { parseSumma, formatSummaInput } from "@/lib/uzs-input";

export function CrmPropertiesView() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <CrmGlassCard
        title="Mulk boshqaruvi"
        description="Turar-joy, tijorat, transport, jihozlar va tadbir mulklari"
      >
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(PROPERTY_CATEGORIES).map(([key, cat]) => (
            <Badge key={key} variant="secondary" className="text-xs">
              {cat.label}: {cat.types.length} tur
            </Badge>
          ))}
        </div>
        <LandlordListingsTab refreshKey={refreshKey} />
      </CrmGlassCard>
    </div>
  );
}

export function CrmClientsView() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <CrmGlassCard title="Mijozlar voronkasi" description="Lid → Shartnoma → Yopildi">
        <div className="mb-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {CLIENT_PIPELINE.map((stage) => (
            <div
              key={stage.id}
              className="rounded-xl border border-white/10 bg-white/40 p-3 text-center dark:bg-white/5"
            >
              <div
                className="mx-auto mb-2 size-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <p className="text-xs font-medium">{stage.label}</p>
            </div>
          ))}
        </div>
        <LandlordClientsTab refreshKey={refreshKey} />
      </CrmGlassCard>
    </div>
  );
}

const BOOKING_STATUS: Record<BookingStatus, string> = {
  available: "Bo'sh",
  reserved: "Band qilingan",
  booked: "Ijarada",
  maintenance: "Ta'mir",
};

const EMPTY_BOOKING = {
  propertyTitle: "",
  clientName: "",
  clientPhone: "",
  startDate: "",
  endDate: "",
  totalPrice: "",
  status: "reserved" as BookingStatus,
  notes: "",
};

export function CrmBookingsView() {
  const [bookings, setBookings] = useState<CrmBooking[]>([]);
  const [form, setForm] = useState(EMPTY_BOOKING);
  const [showForm, setShowForm] = useState(false);

  const reload = () => setBookings(getCrmBookings());

  useEffect(() => {
    reload();
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.propertyTitle || !form.clientName || !form.startDate || !form.endDate) {
      toast.error("Majburiy maydonlarni to'ldiring");
      return;
    }
    saveCrmBooking({
      propertyTitle: form.propertyTitle,
      clientName: form.clientName,
      clientPhone: form.clientPhone,
      startDate: form.startDate,
      endDate: form.endDate,
      totalPrice: parseSumma(form.totalPrice) ?? 0,
      status: form.status,
      notes: form.notes || undefined,
    });
    toast.success("Bron qo'shildi");
    setForm(EMPTY_BOOKING);
    setShowForm(false);
    reload();
  };

  return (
    <div className="space-y-6">
      <CrmGlassCard
        title="Bronlash tizimi"
        description="Kunlik, haftalik va oylik kalendar ko'rinishi"
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="size-4" />
            Yangi bron
          </Button>
        }
      >
        {showForm && (
          <form onSubmit={onSubmit} className="mb-6 grid gap-4 rounded-xl border border-white/10 bg-white/30 p-4 dark:bg-white/5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mulk nomi</Label>
              <Input value={form.propertyTitle} onChange={(e) => setForm((f) => ({ ...f, propertyTitle: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mijoz</Label>
              <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.clientPhone} onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Boshlanish</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tugash</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Summa</Label>
              <Input value={form.totalPrice} onChange={(e) => setForm((f) => ({ ...f, totalPrice: formatSummaInput(e.target.value) }))} placeholder="1 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>Holat</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as BookingStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BOOKING_STATUS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Saqlash</Button>
            </div>
          </form>
        )}

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Calendar className="mb-3 size-10 text-[#38BDF8]" />
            <p className="text-sm text-slate-500">Hali bronlar yo&apos;q</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/40 px-4 py-3 dark:bg-white/5"
              >
                <div>
                  <p className="font-medium">{b.propertyTitle}</p>
                  <p className="text-sm text-slate-500">
                    {b.clientName} · {b.startDate} — {b.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{BOOKING_STATUS[b.status]}</Badge>
                  <span className="text-sm font-semibold text-[#2563EB]">
                    {formatUzs(b.totalPrice)}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => { deleteCrmBooking(b.id); reload(); toast.success("O'chirildi"); }}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CrmGlassCard>
    </div>
  );
}

export function CrmAdsView() {
  const ads = [
    { type: "Top Listing", impressions: 4200, clicks: 186, leads: 24, cr: "5.6%" },
    { type: "Featured", impressions: 3100, clicks: 142, leads: 18, cr: "4.8%" },
    { type: "Banner", impressions: 8900, clicks: 210, leads: 12, cr: "2.4%" },
  ];
  return (
    <CrmGlassCard title="Reklama tizimi" description="Top, Featured, Banner va bosh sahifa reklamalari">
      <div className="grid gap-4 sm:grid-cols-3">
        {ads.map((ad) => (
          <div key={ad.type} className="rounded-xl border border-white/10 bg-gradient-to-br from-[#2563EB]/10 to-transparent p-4">
            <p className="font-semibold">{ad.type}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>Ko&apos;rinish: {ad.impressions.toLocaleString()}</span>
              <span>Bosish: {ad.clicks}</span>
              <span>Lidlar: {ad.leads}</span>
              <span className="font-semibold text-[#22C55E]">CR: {ad.cr}</span>
            </div>
          </div>
        ))}
      </div>
    </CrmGlassCard>
  );
}

export function CrmPaymentsView() {
  const rows = [
    { label: "Ijara to'lovlari", amount: "12 500 000", status: "To'langan" },
    { label: "Depozitlar", amount: "3 200 000", status: "Kutilmoqda" },
    { label: "Xarajatlar", amount: "1 450 000", status: "Hisoblangan" },
  ];
  return (
    <CrmGlassCard title="To'lovlar va hisob-fakturalar" description="Kunlik, haftalik, oylik va yillik hisobotlar">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/40 px-4 py-3 dark:bg-white/5">
            <div>
              <p className="font-medium">{r.label}</p>
              <p className="text-lg font-bold text-[#2563EB]">{r.amount} so&apos;m</p>
            </div>
            <Badge variant="secondary">{r.status}</Badge>
          </div>
        ))}
      </div>
    </CrmGlassCard>
  );
}

export function CrmMessagesView() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <CrmGlassCard title="Xabarlar markazi" description="E'lonlarga kelgan murojaatlar">
      <LandlordMessagesTab refreshKey={refreshKey} />
    </CrmGlassCard>
  );
}

export function CrmVerificationView() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <CrmGlassCard title="Tekshirish tizimi" description="Verified User, Company, Property, Agency">
      <LandlordVerifyTab onVerified={() => setRefreshKey((k) => k + 1)} />
    </CrmGlassCard>
  );
}

export function CrmReportsView() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <CrmGlassCard title="Hisobotlar" description="Excel, PDF, daromad va mulk hisobotlari">
      <LandlordReportsTab refreshKey={refreshKey} />
    </CrmGlassCard>
  );
}
