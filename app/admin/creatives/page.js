import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import { saveCreative, deleteCreative } from "@/app/actions/admin";

export default async function Creatives() {
  const creatives = await prisma.creative.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Creatives" subtitle="Banners, images and ready-made copy affiliates can use. Links are tagged with each affiliate's code automatically." />
      <form action={saveCreative} className="card mb-6 grid max-w-3xl gap-3 p-6 sm:grid-cols-2">
        <div className="font-medium sm:col-span-2">Add a creative</div>
        <div><label className="label">Name</label><input name="name" required className="input" /></div>
        <div><label className="label">Links to (academy URL)</label><input name="url" type="url" required className="input" placeholder="https://www.truecosmic.com/academy/..." /></div>
        <div className="sm:col-span-2"><label className="label">Image URL (optional)</label><input name="imageUrl" type="url" className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Suggested post text (optional)</label><textarea name="text" rows={3} className="input" /></div>
        <div><button className="btn-primary">Add creative</button></div>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {creatives.map((c) => (
          <div key={c.id} className="card overflow-hidden">
            {c.imageUrl && <img src={c.imageUrl} alt="" className="h-40 w-full object-cover" />}
            <div className="space-y-2 p-4">
              <div className="font-medium">{c.name}</div>
              <div className="truncate text-xs text-slate-400">{c.url}</div>
              {c.text && <p className="text-sm text-slate-600">{c.text}</p>}
              <form action={deleteCreative.bind(null, c.id)}><button className="btn-danger btn-sm">Remove</button></form>
            </div>
          </div>
        ))}
      </div>
      {!creatives.length && <div className="card"><Empty>No creatives yet</Empty></div>}
    </>
  );
}
