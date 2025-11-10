import * as React from "react";
import PageHeader from "@/components/page-header";
import { InventoryView } from "@/components/inventory/inventory-view";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Header */}
      <PageHeader className="md:col-span-3" />


      {/* Inventory dashboard content (3 cards + recent activity) */}
      <InventoryView />
    </div>
  );
}
