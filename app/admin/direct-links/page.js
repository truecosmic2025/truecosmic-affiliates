import Link from "next/link";
import { prisma } from "@/lib/db";
import { fullName, date } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { setDirectLinkStatus } from "@/app/actions/admin";

export default async function DirectLinks() {
  const links = await prisma.directLink.findMany({ include: { affiliate: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Direct link tracking" subtitle="Affiliates register their own websites. Visitors clicking a plain link from those sites to truecosmic.com are credited without a ?ref= in the URL. Approve only domains you've checked belong to the affiliate." />
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Domain</th><th>Affiliate</th><th>Requested</th><th>Status</th><th></th></tr></thead>
          <tbody>{links.map((l) => (
            <tr key={l.id}><td><a href={`https://${l.domain}`} target="_blank" className="font-mono text-cosmic-700">{l.domain}</a></td>
              <td><Link href={`/admin/affiliates/${l.affiliateId}`}>{fullName(l.affiliate)}</Link></td><td>{date(l.createdAt)}</td>
              <td><Badge value={l.status === "approved" ? "ACTIVE" : l.status === "pending" ? "PENDING" : "REJECTED"} /></td>
              <td className="flex gap-1">
                {l.status !== "approved" && <form action={setDirectLinkStatus.bind(null, l.id, "approved")}><button className="btn-primary btn-sm">Approve</button></form>}
                {l.status !== "rejected" && <form action={setDirectLinkStatus.bind(null, l.id, "rejected")}><button className="btn-danger btn-sm">Reject</button></form>}
              </td></tr>
          ))}</tbody>
        </table>
        {!links.length && <Empty>No direct links requested yet</Empty>}
      </div>
    </>
  );
}
