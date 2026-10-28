import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ImportForm from "@/components/ImportForm";
import ConfirmButton from "@/components/ConfirmButton";
import { inviteImportedAffiliates } from "@/app/actions/admin";

export default async function ImportPage({ searchParams }) {
  const imported = await prisma.affiliate.count({ where: { notes: "Imported from AffiliateWP" } });
  return (
    <>
      <PageHeader title="Import from AffiliateWP" subtitle="Move your existing affiliates and their history across. Safe to run more than once: matching records are updated, not duplicated." />
      {searchParams.invited && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Sent the welcome email to {searchParams.invited} affiliates.</p>}
      <ol className="card mb-6 list-decimal space-y-1 p-6 pl-10 text-sm text-slate-600">
        <li>In WordPress go to <strong>Affiliates → Tools → Export</strong>.</li>
        <li>Export <strong>Affiliates</strong> (all statuses) and <strong>Referrals</strong> (all dates, all statuses) as CSV.</li>
        <li>Import affiliates first (step 1 below), then referrals (step 2). Run a preview each time.</li>
        <li>Old links keep working: affiliates keep their username as their code, and their old numeric ID is still recognised.</li>
        <li>When you're happy, send everyone the “we've moved” email (step 3), then deactivate AffiliateWP.</li>
      </ol>
      <div className="grid gap-6 xl:grid-cols-2">
        <ImportForm type="affiliates" title="Step 1 · Affiliates CSV" help="Uses affiliate ID, email, name, username, payment email, rate, rate type and status." />
        <ImportForm type="referrals" title="Step 2 · Referrals CSV" help="Uses affiliate ID or email, amount, currency, reference (order), description, status and date. Paid/unpaid history is preserved." />
      </div>
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div><div className="font-medium">Step 3 · Invite imported affiliates</div><p className="muted">{imported} imported affiliates. Active ones get an email explaining the new dashboard and how to sign in.</p></div>
        <form action={inviteImportedAffiliates}><ConfirmButton className="btn-primary" message="Email every active imported affiliate now?">Send welcome emails</ConfirmButton></form>
      </div>
    </>
  );
}
