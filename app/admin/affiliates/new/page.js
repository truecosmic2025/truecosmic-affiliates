import { PageHeader } from "@/components/ui";
import RateFields from "@/components/RateFields";
import { createAffiliate } from "@/app/actions/admin";

export default function NewAffiliate({ searchParams }) {
  return (
    <>
      <PageHeader title="Add affiliate" />
      {searchParams.error && <p className="mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error === "exists" ? "An affiliate with that email already exists." : "Email is required."}</p>}
      <form action={createAffiliate} className="card max-w-2xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">First name</label><input name="firstName" className="input" /></div>
          <div><label className="label">Last name</label><input name="lastName" className="input" /></div>
          <div><label className="label">Email *</label><input name="email" type="email" required className="input" /></div>
          <div><label className="label">PayPal / payment email</label><input name="paymentEmail" type="email" className="input" /></div>
          <div><label className="label">Referral code</label><input name="code" className="input" placeholder="auto from name" /></div>
          <div><label className="label">Status</label>
            <select name="status" className="input" defaultValue="ACTIVE"><option>ACTIVE</option><option>PENDING</option><option>INACTIVE</option></select>
          </div>
        </div>
        <RateFields />
        <button className="btn-primary">Create affiliate</button>
      </form>
    </>
  );
}
