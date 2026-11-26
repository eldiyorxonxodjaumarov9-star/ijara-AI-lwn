"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { RobotRentCrm } from "@/components/robotrent/robotrent-crm";

export default function RobotRentCrmPage() {
  return (
    <ProtectedRoute roles={["admin", "manager"]}>
      <RobotRentCrm />
    </ProtectedRoute>
  );
}
