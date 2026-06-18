import type { DemoAnalysisResult } from "@/lib/ai/demo";

export const DEMO_ANALYSIS_KEY = "arendahub:demo-analysis";

export type StoredDemoAnalysis = DemoAnalysisResult & { createdAt: string };

export function persistDemoAnalysis(result: DemoAnalysisResult) {
  if (typeof window === "undefined") return;
  const stored: StoredDemoAnalysis = {
    ...result,
    createdAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(DEMO_ANALYSIS_KEY, JSON.stringify(stored));
}

export function loadDemoAnalysis(): StoredDemoAnalysis | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DEMO_ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDemoAnalysis;
  } catch {
    return null;
  }
}
