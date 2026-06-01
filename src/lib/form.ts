import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";

/**
 * zodResolver'ni RHF generikasiga moslab qaytaradi.
 * z.coerce ishlatilganda kirish/chiqish tiplari mos kelmasligi sababli
 * yagona joyda xavfsiz kasting qilamiz.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zResolver<T extends FieldValues>(schema: any): Resolver<T> {
  return zodResolver(schema) as unknown as Resolver<T>;
}
