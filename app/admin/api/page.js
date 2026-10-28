import { prisma } from "@/lib/db";
import { date } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import CopyField from "@/components/CopyField";
import { createApiKey, deleteApiKey, createWebhook, deleteWebhook, testWebhook } from "@/app/actions/admin";

const EVENTS = ["affiliate.created", "affiliate.approved", "affiliate.updated", "referral.created", "referral.updated", "payout.created", "dispute.opened"];

export default async function Api({ searchParams }) {
  const [keys, hooks] = await Promise.all([prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } }), prisma.webhook.findMany({ orderBy: { createdAt: "desc" } })]);
  const base = process.env.APP_URL;
  return (
    <>
      <PageHeader title="API & webhooks" subtitle="Connect Make, Zapier, n8n or your own tools." />
      {searchParams.newkey && (
        <div className="card mb-6 space-y-2 border-amber-300 bg-amber-50 p-5">
          <div className="font-medium">Your new API key. Copy it now: it won't be shown again.</div>
          <CopyField value={searchParams.newkey} />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="px-5 pt-5 font-medium">REST API keys</div>
          <div className="space-y-1 px-5 pt-2 text-xs text-slate-500">
            <p>Send <code>Authorization: Bearer &lt;key&gt;</code>. Endpoints:</p>
            <pre className="overflow-x-auto rounded bg-slate-50 p-3">{`GET  ${base}/api/v1/affiliates?status=active&email=
GET  ${base}/api/v1/affiliates/{id or code}
POST ${base}/api/v1/affiliates        {email, first_name, last_name, status, rate_type, rate}
PATCH ${base}/api/v1/affiliates/{id}  {status, rate_type, rate, payment_email, group_id}
GET  ${base}/api/v1/referrals?affiliate_id=&status=&since=
POST ${base}/api/v1/referrals         {affiliate_id, amount, description, order_id}
GET  ${base}/api/v1/visits?affiliate_id=&since=
GET  ${base}/api/v1/payouts?affiliate_id=
GET  ${base}/api/v1/products`}</pre>
          </div>
          <table className="table mt-3"><thead><tr><th>Name</th><th>Key</th><th>Last used</th><th></th></tr></thead>
            <tbody>{keys.map((k) => <tr key={k.id}><td>{k.name}</td><td className="font-mono text-xs">{k.prefix}…</td><td>{k.lastUsedAt ? date(k.lastUsedAt) : "never"}</td>
              <td><form action={deleteApiKey.bind(null, k.id)}><button className="btn-danger btn-sm">Revoke</button></form></td></tr>)}</tbody>
          </table>
          {!keys.length && <Empty>No keys</Empty>}
          <form action={createApiKey} className="flex gap-2 border-t border-slate-100 p-5"><input name="name" placeholder="Key name, e.g. Make" className="input" /><button className="btn-primary shrink-0">Create key</button></form>
        </section>
        <section className="card">
          <div className="px-5 pt-5 font-medium">Outgoing webhooks</div>
          <p className="muted px-5">We POST JSON to your URL when things happen. Each request is signed: <code>X-TC-Signature</code> = HMAC-SHA256 of the body with the webhook's secret.</p>
          <table className="table mt-3"><thead><tr><th>URL</th><th>Events</th><th>Secret</th><th></th></tr></thead>
            <tbody>{hooks.map((h) => <tr key={h.id}><td className="max-w-[200px] break-all text-xs">{h.url}</td><td className="text-xs">{h.events.join(", ")}</td><td className="font-mono text-xs">{h.secret}</td>
              <td className="flex gap-1"><form action={testWebhook.bind(null, h.id)}><button className="btn-secondary btn-sm">Test</button></form><form action={deleteWebhook.bind(null, h.id)}><button className="btn-danger btn-sm">Delete</button></form></td></tr>)}</tbody>
          </table>
          {!hooks.length && <Empty>No webhooks</Empty>}
          <form action={createWebhook} className="space-y-3 border-t border-slate-100 p-5">
            {searchParams.error === "url" && <p className="text-sm text-red-600">Webhook URLs must start with https://</p>}
            <input name="url" type="url" required placeholder="https://hook.eu1.make.com/..." className="input" />
            <div className="flex flex-wrap gap-3 text-sm">{EVENTS.map((e) => <label key={e} className="flex items-center gap-1"><input type="checkbox" name="events" value={e} /> {e}</label>)}</div>
            <p className="text-xs text-slate-400">Tick none to receive every event.</p>
            <button className="btn-primary">Add webhook</button>
          </form>
        </section>
      </div>
    </>
  );
}
