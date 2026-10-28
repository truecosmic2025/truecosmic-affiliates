import { prisma } from "@/lib/db";
import { requireAffiliate } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { rateFor } from "@/lib/commission";
import { commissionContext } from "@/lib/referrals";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import LinkBuilder from "@/components/LinkBuilder";

export default async function Links() {
  const { affiliate } = await requireAffiliate();
  const s = await getSettings();
  const products = await prisma.product.findMany({ where: { deleted: false, status: "publish", commissionEnabled: true }, orderBy: { createdAt: "desc" } });
  const ctx = await commissionContext(affiliate, "sale");
  const prices = {};
  const list = products.map((p) => {
    const { type, rate, promotion } = rateFor({ product: p, affiliate, settings: s, ctx });
    prices[p.id] = money(p.price, s.currency);
    const earn = type === "FLAT" ? money(rate, s.currency) : `${rate}% (${money((Number(p.price) * rate) / 100, s.currency)})`;
    return { id: p.id, name: p.name, kind: p.kind, permalink: p.permalink, earn: promotion ? `${earn} · ${promotion}` : earn };
  });
  return (
    <>
      <PageHeader title="Products & links" subtitle="Every course, ebook and coaching offer in the academy, with your link ready to copy. New products appear here as soon as they're published." />
      <LinkBuilder products={list} money={prices} code={affiliate.code} referralVar={s.referralVar} shortBase={process.env.APP_URL} academyUrl={s.academyUrl} />
    </>
  );
}
