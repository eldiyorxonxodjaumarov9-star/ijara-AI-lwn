"use client";

import { useState } from "react";
import { MapPin, Search, Sparkles } from "lucide-react";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatUzs,
  searchRentalListings,
  type RentalListing,
} from "@/lib/rental-search";
import { recordRentalSearchLead } from "@/lib/rental-search-leads";

const EXAMPLES = [
  "Chilonzorda 2 xonali kvartira kerak, budjet 5 million",
  "Yunusobodda 3 xonali uy, 6 milliongacha",
  "Sergelida arzon 1 xonali kvartira",
  "Chilonzorda ofis 45 m²",
];

export function AiSearchPortal() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RentalListing[]>([]);
  const [parsedHint, setParsedHint] = useState("");

  const onSearch = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery(q);
    const { parsed, results: found } = searchRentalListings(q);
    setResults(found);
    setSearched(true);
    recordRentalSearchLead(q, parsed, found.length);

    const hints: string[] = [];
    if (parsed.districts.length) hints.push(`Hudud: ${parsed.districts.join(", ")}`);
    if (parsed.rooms) hints.push(`${parsed.rooms} xona`);
    if (parsed.maxPrice) hints.push(`Budjet: ${formatUzs(parsed.maxPrice)} gacha`);
    if (parsed.propertyType) hints.push(`Tur: ${parsed.propertyType}`);
    setParsedHint(
      hints.length > 0
        ? `AI tushundi: ${hints.join(" · ")}`
        : "Kalit so'zlar bo'yicha qidirildi"
    );
  };

  return (
    <div className="min-h-screen bg-[#060d18] text-white selection:bg-cyan-500/30">
      <LandingNavbar activePath="/ai-qidiruv" />
      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300">
              <Sparkles className="size-4" />
              Arendaga oluvchilar uchun
            </span>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              AI{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Qidiruv
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Oddiy tilda yozing — AI hudud, xona soni, narx va talablarni
              tushunib, mos e&apos;lonlarni topadi.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder='Masalan: "Chilonzorda 2 xonali kvartira, 5 million"'
                className="h-12 flex-1 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
              <Button
                onClick={() => onSearch()}
                className="h-12 gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 px-6 hover:from-blue-500 hover:to-cyan-400"
              >
                <Search className="size-4" />
                Qidirish
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => onSearch(ex)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {searched && (
            <div className="mt-8">
              <p className="text-sm text-cyan-400">{parsedHint}</p>
              <p className="mt-1 text-sm text-slate-500">
                {results.length} ta natija topildi
              </p>

              <div className="mt-6 space-y-4">
                {results.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
                    Mos e&apos;lon topilmadi. Boshqa so&apos;zlar bilan urinib
                    ko&apos;ring.
                  </div>
                ) : (
                  results.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent p-5 transition-colors hover:border-cyan-500/20"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {item.title}
                          </h3>
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                            <MapPin className="size-3.5" />
                            {item.district} · {item.rooms} xona · {item.area} m²
                          </p>
                        </div>
                        <p className="text-xl font-bold text-cyan-400">
                          {formatUzs(item.price)}
                        </p>
                      </div>
                      {item.description && (
                        <p className="mt-3 text-sm text-slate-400">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">{item.propertyType}</Badge>
                        <Badge variant="outline" className="border-white/20 text-slate-400">
                          {item.source === "landlord" ? "Ijara egasi" : "Arenda AI"}
                        </Badge>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
