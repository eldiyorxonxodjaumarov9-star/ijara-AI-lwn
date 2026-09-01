"use client";

import { use } from "react";

import { LwnRoomManageView } from "@/components/lwn/lwn-room-manage-view";

export default function LwnRoomManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <LwnRoomManageView roomId={id} />;
}
