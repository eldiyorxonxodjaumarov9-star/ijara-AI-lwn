"use client";

import { useState } from "react";
import { Search, ShieldCheck, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLandlordProfile } from "@/lib/landlord-profile";
import { findInquiries, getInquiryCompanyName, type RentalInquiry } from "@/lib/rental-inquiries";
import { formatDate } from "@/lib/utils";

export function LandlordVerifyTab({ onVerified }: { onVerified: () => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<RentalInquiry[] | null>(null);

  const onCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const email = getLandlordProfile()?.email ?? "";
    const found = findInquiries(query, email || undefined);
    setMatches(found);
    onVerified();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onCheck}
        className="rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <h3 className="font-semibold">Mijozni tekshirish</h3>
        <p className="mt-1 text-sm text-slate-400">
          Ism, telefon yoki e&apos;lon bo&apos;yicha mijozni toping.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label>Qidiruv</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-white/10 bg-white/5 text-white"
            placeholder="Ism, telefon, e'lon nomi..."
          />
        </div>
        <Button type="submit" className="mt-4 gap-2">
          <Search className="size-4" />
          Tekshirish
        </Button>
      </form>

      {matches !== null && (
        <div
          className={`rounded-xl border p-5 ${
            matches.length > 0
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <div className="flex items-start gap-3">
            {matches.length > 0 ? (
              <ShieldCheck className="size-6 shrink-0 text-emerald-400" />
            ) : (
              <ShieldX className="size-6 shrink-0 text-red-400" />
            )}
            <div className="flex-1">
              <p className="font-medium text-white">
                {matches.length > 0
                  ? `${matches.length} ta mijoz topildi`
                  : "Mijoz topilmadi"}
              </p>
              {matches.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {matches.map((inq) => (
                    <li
                      key={inq.id}
                      className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
                    >
                      <p className="font-medium text-white">
                        {getInquiryCompanyName(inq)}
                      </p>
                      <p className="text-slate-400">
                        {inq.activityType}
                        {inq.activitySince ? ` · ${inq.activitySince}` : ""}
                        {inq.kv ? ` · ${inq.kv} m²` : ""}
                      </p>
                      {inq.briefInfo && (
                        <p className="mt-1 text-slate-500">{inq.briefInfo}</p>
                      )}
                      <p className="mt-1 text-slate-300">{inq.message}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {inq.listingTitle} · {formatDate(inq.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
