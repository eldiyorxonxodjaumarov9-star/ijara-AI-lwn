"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Phone, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLandlordProfile } from "@/lib/landlord-profile";
import {
  deleteRentalInquiry,
  getInquiryCompanyName,
  getInquiryPhone,
  getListingMessagesForLandlord,
  type RentalInquiry,
} from "@/lib/rental-inquiries";
import { formatUzs } from "@/lib/rental-search";
import { formatDate } from "@/lib/utils";

export function LandlordMessagesTab({ refreshKey }: { refreshKey: number }) {
  const [messages, setMessages] = useState<RentalInquiry[]>([]);
  const landlordEmail = getLandlordProfile()?.email ?? "";

  const reload = () => {
    setMessages(getListingMessagesForLandlord(getLandlordProfile()?.email));
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Xabarlar</h3>
          <p className="text-sm text-slate-400">
            Arendatorlar e&apos;lonlaringizga yuborgan xabarlar shu yerda
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={reload}
        >
          <RefreshCw className="size-4" />
          Yangilash
        </Button>
      </div>

      {!landlordEmail && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Profilda email kiriting — xabarlar shu email bilan bog&apos;lanadi.
        </p>
      )}

      {messages.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center">
          <MessageCircle className="mx-auto size-10 text-slate-600" />
          <p className="mt-3 text-slate-500">Hali xabarlar yo&apos;q</p>
          <p className="mt-1 text-sm text-slate-600">
            Ijara qidiruvdan e&apos;loningizga xabar yuborilganda bu yerda ko&apos;rinadi
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <article
              key={msg.id}
              className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white">
                      {getInquiryCompanyName(msg)}
                    </h4>
                    {msg.renterLogin && (
                      <span className="text-xs text-slate-500">@{msg.renterLogin}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-cyan-400">
                    E&apos;lon: {msg.listingTitle}
                  </p>
                  {getInquiryPhone(msg) && (
                    <a
                      href={`tel:${getInquiryPhone(msg).replace(/\s/g, "")}`}
                      className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline"
                    >
                      <Phone className="size-3.5" />
                      {getInquiryPhone(msg)}
                    </a>
                  )}
                  <p className="text-xs text-slate-500">{formatDate(msg.createdAt)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-slate-400 hover:text-red-400"
                  onClick={() => {
                    deleteRentalInquiry(msg.id);
                    reload();
                    toast.success("Xabar o'chirildi");
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="whitespace-pre-wrap text-sm text-slate-300">{msg.message}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{msg.activityType}</Badge>
                {msg.kv > 0 && <Badge variant="outline">{msg.kv} m²</Badge>}
                {msg.summa > 0 && (
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                    {formatUzs(msg.summa)}
                  </Badge>
                )}
                {msg.instagramLink && (
                  <Badge variant="outline" className="max-w-[200px] truncate">
                    {msg.instagramLink}
                  </Badge>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
