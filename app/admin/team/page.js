import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { date } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";
import { addStaff, removeStaff } from "@/app/actions/admin";

export default async function Team({ searchParams }) {
  const me = await requireAdmin();
  const staff = await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  const owner = process.env.ADMIN_EMAIL?.toLowerCase();
  return (
    <>
      <PageHeader title="Team" subtitle="People who can sign in to this admin, e.g. your accounts agent for disputes and payouts. They sign in with an emailed link." />
      {searchParams.added && <p className="mb-4 max-w-2xl rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Added and emailed a sign-in link.</p>}
      {searchParams.error && <p className="mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error === "email" ? "Enter a valid email." : "You can't remove yourself or the owner account."}</p>}
      <div className="card mb-6 max-w-2xl">
        {staff.map((u) => (
          <div key={u.id} className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm last:border-0">
            <span>{u.name || "—"} <span className="text-slate-400">{u.email}</span>{u.email === owner && <span className="ml-2 text-xs text-cosmic-600">owner</span>}</span>
            <span className="flex items-center gap-3 text-xs text-slate-400">since {date(u.createdAt)}
              {u.id !== me.id && u.email !== owner && <form action={removeStaff.bind(null, u.id)}><ConfirmButton className="btn-danger btn-sm" message={`Remove admin access for ${u.email}?`}>Remove</ConfirmButton></form>}</span>
          </div>
        ))}
      </div>
      <form action={addStaff} className="card flex max-w-2xl flex-wrap gap-2 p-5">
        <input name="name" placeholder="Name, e.g. Franklin" className="input flex-1" />
        <input name="email" type="email" required placeholder="email@truecosmic.com" className="input flex-1" />
        <button className="btn-primary">Add team member</button>
      </form>
    </>
  );
}
