import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import RateFields from "@/components/RateFields";
import { createAffiliate } from "@/app/actions/admin";

const ERR = { exists: "An affiliate with that email already exists.", email: "A valid email is required." };

export default async function NewAffiliate({ searchParams }) {
  const groups = await prisma.affiliateGroup.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Add affiliate" subtitle="They'll get the approval email and can log in straight away with their email address." />
      {searchParams.error && <p className="mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERR[searchParams.error] || "Something went wrong."}</p>}
      <form action={createAffiliate} className="card max-w-2xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">First name</label><input name="firstName" className="input" /></div>
          <div><label className="label">Last name</label><input name="lastName" className="input" /></div>
          <div><label className="label">Email *</label><input name="email" type="email" required className="input" /></div>
          <div><label className="label">PayPal / payment email</label><input name="paymentEmail" type="email" className="input" /></div>
          <div><label className="label">Referral code</label><input name="code" className="input" placeholder="auto from name" /></div>
          <div><label className="label">Status</label><select name="status" className="input" defaultValue="ACTIVE"><option>ACTIVE</option><option>PENDING</option><option>INACTIVE</option></select></div>
          <div><label className="label">Group</label><select name="groupId" className="input" defaultValue=""><option value="">Default</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div><label className="label">Recruited by (code)</label><input name="parentRef" className="input" placeholder="for multi-tier" /></div>
        </div>
        <RateFields />
        <button className="btn-primary">Create affiliate</button>
      </form>
    </>
  );
}
