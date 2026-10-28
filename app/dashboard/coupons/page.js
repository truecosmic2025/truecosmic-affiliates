import { requireAffiliate } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import CopyField from "@/components/CopyField";

export default async function MyCoupons() {
  const { affiliate } = await requireAffiliate();
  return (
    <>
      <PageHeader title="Coupons" subtitle="Share these codes on podcasts, videos or anywhere a link doesn't work. Any order using them is credited to you, no click needed." />
      <div className="grid max-w-2xl gap-3">{affiliate.coupons.map((c) => <div key={c} className="card p-4"><CopyField value={c} /></div>)}</div>
    </>
  );
}
