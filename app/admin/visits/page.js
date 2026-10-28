import { prisma } from "@/lib/db";
import { fullName } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";

export default async function Visits() {
  const visits = await prisma.visit.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { affiliate: true } });
  return (
    <>
      <PageHeader title="Visits" subtitle="Clicks on affiliate links (latest 300). Repeat clicks from the same visitor within 30 minutes count once." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Affiliate</th><th>Landing page</th><th>Came from</th><th>Campaign</th><th>Converted</th></tr></thead>
          <tbody>{visits.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap">{v.createdAt.toLocaleString("en-GB")}</td>
              <td>{fullName(v.affiliate)}</td>
              <td className="max-w-xs truncate text-xs">{v.url}</td>
              <td className="max-w-xs truncate text-xs">{v.referrer || "direct"}</td>
              <td>{v.campaign}</td>
              <td>{v.converted ? "✓" : ""}</td>
            </tr>
          ))}</tbody>
        </table>
        {!visits.length && <Empty>No visits recorded yet</Empty>}
      </div>
    </>
  );
}
