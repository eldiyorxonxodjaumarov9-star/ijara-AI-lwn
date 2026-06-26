"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLandlordProfile } from "@/lib/landlord-profile";
import {
  deleteRentalInquiry,
  getGlobalInquiriesForLandlord,
  getInquiryCompanyName,
  getInquiryPhone,
  isGlobalInquiry,
  type RentalInquiry,
} from "@/lib/rental-inquiries";
import { formatUzs } from "@/lib/rental-search";
import { formatDate } from "@/lib/utils";

export function LandlordClientsTab({ refreshKey }: { refreshKey: number }) {
  const [inquiries, setInquiries] = useState<RentalInquiry[]>([]);
  const landlordEmail = getLandlordProfile()?.email ?? "";

  const reload = () => {
    setInquiries(getGlobalInquiriesForLandlord(getLandlordProfile()?.email));
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Mijozlar ro&apos;yxati</h3>
          <p className="text-sm text-slate-400">
            Ijara qidiruv formasini to&apos;ldirgan firmalar — barcha ijara egalari
            ko&apos;radi
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
          Profilda email ko&apos;rsatilmagan. E&apos;lon joylashda email saqlanadi.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400">Firma</TableHead>
              <TableHead className="text-slate-400">Telefon</TableHead>
              <TableHead className="text-slate-400">Faoliyat</TableHead>
              <TableHead className="text-slate-400">KV</TableHead>
              <TableHead className="text-slate-400">Summa</TableHead>
              <TableHead className="text-slate-400">E&apos;lon</TableHead>
              <TableHead className="text-slate-400">Vaqt</TableHead>
              <TableHead className="text-slate-400" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {inquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  Hali mijozlar yo&apos;q
                </TableCell>
              </TableRow>
            ) : (
              inquiries.map((inq) => (
                <TableRow key={inq.id} className="border-white/10">
                  <TableCell>
                    <div className="font-medium text-white">
                      {getInquiryCompanyName(inq)}
                    </div>
                    {inq.instagramLink && (
                      <div className="text-xs text-cyan-400">{inq.instagramLink}</div>
                    )}
                    {inq.briefInfo && (
                      <div className="mt-1 max-w-[200px] truncate text-xs text-slate-500">
                        {inq.briefInfo}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-cyan-400">
                    {getInquiryPhone(inq) ? (
                      <a
                        href={`tel:${getInquiryPhone(inq).replace(/\s/g, "")}`}
                        className="hover:underline"
                      >
                        {getInquiryPhone(inq)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">
                    <div>{inq.activityType || "—"}</div>
                    {inq.activitySince && (
                      <div className="text-xs text-slate-500">{inq.activitySince}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">
                    {inq.kv ? `${inq.kv} m²` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">
                    {inq.summa ? formatUzs(inq.summa) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm text-slate-400">
                    {isGlobalInquiry(inq) ? (
                      <span className="text-cyan-400">Qidiruv so&apos;rovi</span>
                    ) : (
                      inq.listingTitle
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">
                    {formatDate(inq.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-400"
                      onClick={() => {
                        deleteRentalInquiry(inq.id);
                        reload();
                        toast.success("O'chirildi");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
