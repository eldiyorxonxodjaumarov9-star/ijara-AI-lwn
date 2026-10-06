import { hermesRuntimeRetired } from "@/lib/api-server/agent-gateway/retired";

export async function PATCH() {
  return hermesRuntimeRetired();
}
