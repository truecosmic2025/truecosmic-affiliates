import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { requestDirectLink } from "@/app/actions/affiliate";

const ERR = { invalid: "That doesn't look like a valid website.", taken: "That website is already registered.", limit: "You can register up to 5 websites." };

export default async function MyDirectLinks({ searchParams }) {
  const { affiliate } = await requireAffiliate();
  const links = await prisma.directLink.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Direct links" subtitle="Register your website and any plain link from it to truecosmic.com earns you commission, no ?ref= needed. Great for old blog posts and newsletters. Each site is checked before it goes live." />
      {searchParams.sent && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Submitted for approval.</p>}
      {searchParams.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERR[searchParams.error]}</p>}
      <form action={requestDirectLink} className="card mb-6 flex max-w-xl gap-2 p-5"><input name="domain" required placeholder="yourblog.com" className="input" /><button className="btn-primary shrink-0">Add website</button></form>
      <div className="card max-w-xl">
        {links.map((l) => <div key={l.id} className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm last:border-0"><span className="font-mono">{l.domain}</span><Badge value={l.status === "approved" ? "ACTIVE" : l.status === "pending" ? "PENDING" : "REJECTED"} /></div>)}
        {!links.length && <Empty>No websites registered</Empty>}
      </div>
    </>
  );
}
