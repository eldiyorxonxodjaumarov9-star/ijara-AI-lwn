import { getCollectionApi } from "@/lib/data/store";
import { isApiConfigured, apiFetch } from "@/lib/api/client";
import type { Client, Contract, Tenant } from "@/types";

export async function applyClientDeposit(
  client: Client,
  depositPaid: boolean,
  depositAmount: number
) {
  if (isApiConfigured) {
    await apiFetch(`/clients/${client.id}`, {
      method: "PATCH",
      body: { depositPaid, depositAmount },
    });
    return;
  }

  const clientApi = getCollectionApi<Client>("clients");
  await clientApi.update(client.id, { depositPaid, depositAmount });

  if (!client.tenantId) return;

  const tenantApi = getCollectionApi<Tenant>("tenants");
  await tenantApi.update(client.tenantId, { depositPaid, depositAmount });

  const contracts = await getCollectionApi<Contract>("contracts").list();
  const contract = contracts.find(
    (c) =>
      c.tenantId === client.tenantId &&
      (c.status === "active" || c.status === "pending")
  );
  if (contract) {
    await getCollectionApi<Contract>("contracts").update(contract.id, {
      deposit: depositAmount,
      depositPaid,
    });
  }
}
