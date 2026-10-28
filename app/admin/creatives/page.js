import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import { saveCreative, deleteCreative } from "@/app/actions/admin";

export default async function Creatives() {
  const [creatives, groups] = await Promise.all([prisma.creative.findMany({ orderBy: { createdAt: "desc" } }), prisma.affiliateGroup.findMany({ orderBy: { name: "asc" } })]);
  const gName = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  return (
    <>
      <PageHeader title="Creatives" subtitle="Banners, text links, post copy and QR codes for affiliates. Every link is tagged with the affiliate's code automatically." />
      <form action={saveCreative} className="card mb-6 grid max-w-3xl gap-3 p-6 sm:grid-cols-2">
        <div className="font-medium sm:col-span-2">Add a creative</div>
        <div><label className="label">Name</label><input name="name" required className="input" /></div>
        <div><label className="label">Type</label><select name="type" className="input"><option value="image">Image banner</option><option value="text">Text link / post copy</option><option value="qr">QR code</option></select></div>
        <div className="sm:col-span-2"><label className="label">Links to (academy URL)</label><input name="url" type="url" required className="input" placeholder="https://www.truecosmic.com/academy/..." /></div>
        <div className="sm:col-span-2"><label className="label">Image URL (for banners)</label><input name="imageUrl" type="url" className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Link text or suggested post copy</label><textarea name="text" rows={3} className="input" /></div>
        {groups.length > 0 && (
          <div className="sm:col-span-2"><label className="label">Only show to these groups (none ticked = everyone)</label>
            <div className="flex flex-wrap gap-3 text-sm">{groups.map((g) => <label key={g.id} className="flex items-center gap-1"><input type="checkbox" name="groupIds" value={g.id} /> {g.name}</label>)}</div></div>
        )}
        <div><button className="btn-primary">Add creative</button></div>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {creatives.map((c) => (
          <div key={c.id} className="card overflow-hidden">
            {c.imageUrl && <img src={c.imageUrl} alt="" className="h-40 w-full object-cover" />}
            <div className="space-y-2 p-4">
              <div className="flex justify-between"><span className="font-medium">{c.name}</span><span className="text-xs text-slate-400">{c.type}</span></div>
              <div className="truncate text-xs text-slate-400">{c.url}</div>
              {c.text && <p className="text-sm text-slate-600">{c.text}</p>}
              <p className="text-xs text-slate-500">Visible to: {c.groupIds.length ? c.groupIds.map((id) => gName[id] || "?").join(", ") : "everyone"}</p>
              <form action={deleteCreative.bind(null, c.id)}><button className="btn-danger btn-sm">Remove</button></form>
            </div>
          </div>
        ))}
      </div>
      {!creatives.length && <div className="card"><Empty>No creatives yet</Empty></div>}
    </>
  );
}
