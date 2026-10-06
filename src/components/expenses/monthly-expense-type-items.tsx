import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { MONTHLY_EXPENSE_TYPE_GROUPS, MONTHLY_EXPENSE_TYPE_MAP } from "@/lib/constants";

/** Grouped `SelectItem`s for "Oylik xarajat turi" (Kommunal xizmatlar / Majburiy to‘lovlar / Boshqa). */
export function MonthlyExpenseTypeSelectItems() {
  return (
    <>
      {MONTHLY_EXPENSE_TYPE_GROUPS.map((group) => (
        <SelectGroup key={group.label}>
          <SelectLabel>{group.label}</SelectLabel>
          {group.types.map((key) => (
            <SelectItem key={key} value={key}>
              {MONTHLY_EXPENSE_TYPE_MAP[key]}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}
