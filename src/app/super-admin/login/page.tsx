import { redirect } from "next/navigation";

import { getCurrentPlatformAdmin } from "@/lib/api-server/platform-admin/server-session";

import { PlatformAdminLoginForm } from "./login-form";

export default async function PlatformAdminLoginPage() {
  if (await getCurrentPlatformAdmin()) redirect("/super-admin");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <div className="app-auth-card w-full p-5 sm:p-7">
        <PlatformAdminLoginForm />
      </div>
    </main>
  );
}
