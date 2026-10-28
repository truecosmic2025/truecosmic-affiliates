import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { affiliateLink } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import CopyField from "@/components/CopyField";

export default async function MyCreatives() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const creatives = await prisma.creative.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Creatives" subtitle="Ready-made images and copy. Every link below already includes your code." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {creatives.map((c) => {
          const link = affiliateLink(s, affiliate, c.url);
          return (
            <div key={c.id} className="card overflow-hidden">
              {c.imageUrl && <img src={c.imageUrl} alt={c.name} className="h-44 w-full object-cover" />}
              <div className="space-y-3 p-4">
                <div className="font-medium">{c.name}</div>
                {c.text && <p className="whitespace-pre-line text-sm text-slate-600">{c.text}</p>}
                <CopyField value={link} />
                {c.imageUrl && <CopyField value={`<a href="${link}"><img src="${c.imageUrl}" alt="${c.name}" /></a>`} />}
              </div>
            </div>
          );
        })}
      </div>
      {!creatives.length && <div className="card"><Empty>No creatives yet</Empty></div>}
    </>
  );
}
