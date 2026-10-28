import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money, fullName, date } from "@/lib/format";
import { PageHeader, Badge, Tabs, Empty } from "@/components/ui";
import { changeAffiliateStatus } from "@/app/actions/admin";

export default async function Affiliates({ searchParams }) {
  const status = searchParams.status;
  const q = searchParams.q?.trim();
  const s = await getSettings();
  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: ["email", "firstName", "lastName", "code"].map((k) => ({ [k]: { contains: q, mode: "insensitive" } })) } : {}),
  };
  const [affiliates, counts] = await Promise.all([
    prisma.affiliate.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { visits: true } } } }),
    prisma.affiliate.groupBy({ by: ["status"], _count: true }),
  ]);
  const sums = await prisma.referral.groupBy({
    by: ["affiliateId", "status"],
    where: { affiliateId: { in: affiliates.map((a) => a.id) }, status: { in: ["UNPAID", "PAID"] } },
    _sum: { amount: true },
    _count: true,
  });
  const stat = (id, st) => sums.find((x) => x.affiliateId === id && x.status === st);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));
  const total = Object.values(c).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Affiliates" subtitle={`${total} affiliates`}>
        <Link href="/admin/affiliates/new" className="btn-primary">Add affiliate</Link>
      </PageHeader>
      <Tabs
        active={status || "all"}
        items={[
          { key: "all", label: `All (${total})`, href: "/admin/affiliates" },
          ...["ACTIVE", "PENDING", "INACTIVE", "REJECTED"].map((k) => ({ key: k, label: `${k[0] + k.slice(1).toLowerCase()} (${c[k] || 0})`, href: `/admin/affiliates?status=${k}` })),
        ]}
      />
      <form className="mb-4 flex max-w-md gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search name, email or code" className="input" />
        <button className="btn-secondary">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Affiliate</th><th>Code</th><th>Status</th><th>Rate</th><th>Visits</th><th>Sales</th><th>Unpaid</th><th>Paid</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {affiliates.map((a) => {
              const un = stat(a.id, "UNPAID"), pd = stat(a.id, "PAID");
              return (
                <tr key={a.id}>
                  <td><Link href={`/admin/affiliates/${a.id}`} className="font-medium text-cosmic-700">{fullName(a)}</Link><div className="text-xs text-slate-400">{a.email}</div></td>
                  <td className="font-mono text-xs">{a.code}{a.legacyId ? <div className="text-slate-400">wp #{a.legacyId}</div> : null}</td>
                  <td><Badge value={a.status} /></td>
                  <td className="whitespace-nowrap">{a.rate != null ? (a.rateType === "FLAT" ? money(a.rate, s.currency) : `${Number(a.rate)}%`) : <span className="text-slate-400">default</span>}</td>
                  <td>{a._count.visits}</td>
                  <td>{(un?._count || 0) + (pd?._count || 0)}</td>
                  <td>{money(un?._sum.amount, s.currency)}</td>
                  <td>{money(pd?._sum.amount, s.currency)}</td>
                  <td className="whitespace-nowrap">{date(a.createdAt)}</td>
                  <td className="whitespace-nowrap">
                    {a.status === "PENDING" && (
                      <div className="flex gap-1">
                        <form action={changeAffiliateStatus.bind(null, a.id, "ACTIVE")}><button className="btn-primary btn-sm">Approve</button></form>
                        <form action={changeAffiliateStatus.bind(null, a.id, "REJECTED")}><button className="btn-danger btn-sm">Reject</button></form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!affiliates.length && <Empty>No affiliates found. <Link className="text-cosmic-600" href="/admin/import">Import from AffiliateWP</Link></Empty>}
      </div>
    </>
  );
}
