"use client";

import { useMemo } from "react";

import { useAuth } from "@/context/auth-context";
import { getIndustryTerminology } from "@/lib/industry-terminology";

export function useIndustryTerminology() {
  const { workspace } = useAuth();
  const industry = workspace?.industry;
  return useMemo(() => getIndustryTerminology(industry), [industry]);
}
