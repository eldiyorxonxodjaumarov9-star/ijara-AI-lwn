import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { EXPENSE_CATEGORY_GROUPS, EXPENSE_CATEGORY_MAP } from "@/lib/constants";

/** Grouped `SelectItem`s for every expense category (Kommunal xizmatlar / Majburiy to‘lovlar / Boshqa). */
export function ExpenseCategorySelectItems() {
  return (
    <>
      {EXPENSE_CATEGORY_GROUPS.map((group) => (
        <SelectGroup key={group.label}>
          <SelectLabel>{group.label}</SelectLabel>
          {group.categories.map((key) => (
            <SelectItem key={key} value={key}>
              {EXPENSE_CATEGORY_MAP[key]}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}
