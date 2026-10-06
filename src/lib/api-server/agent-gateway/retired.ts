import { fail } from "@/lib/api-server/http";

/**
 * AI Employees (Manager/Payment/Analyst) run on DeepSeek inside the app now.
 * The external Hermes runner's endpoints are closed so it can no longer create
 * runs or send snapshot reports. LWN lead/room routes are unaffected.
 */
export function hermesRuntimeRetired() {
  return fail(
    "Hermes runtime o‘chirildi — AI xodimlar DeepSeek orqali ishlaydi",
    410,
    "HERMES_RUNTIME_RETIRED"
  );
}
