import { AssetView } from "@/components/asset/asset-view";
import PageHeader from "@/components/page-header";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ asset: string }>;
}) {
  const { asset } = await params;
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Header */}
      <PageHeader className="md:col-span-3" />


      {/* Asset content */}
      <div className="md:col-span-3">
        <AssetView asset={asset} />
      </div>
    </div>
  );
}
