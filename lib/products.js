import { prisma, logEvent } from "./db";
import { productKind } from "./commission";
import { getSettings } from "./settings";

// Called from the WordPress connector whenever a WooCommerce product is created or updated,
// so new courses, ebooks and coaching offers show up here automatically.
export async function upsertProduct(p) {
  const wcId = Number(p.id);
  if (!wcId) throw new Error("product id missing");
  const categories = (p.categories || []).map(String);
  const existing = await prisma.product.findUnique({ where: { wcId } });
  const settings = await getSettings();
  const data = {
    name: p.name || `Product ${wcId}`,
    price: Number(p.price || 0),
    permalink: p.permalink || null,
    status: p.status || "publish",
    categories,
    kind: productKind(categories, p.name),
    deleted: false,
  };
  const product = existing
    ? await prisma.product.update({ where: { wcId }, data })
    : await prisma.product.create({ data: { wcId, ...data, commissionEnabled: !!settings.newProductsEarnCommission } });
  await logEvent("product:" + (existing ? "updated" : "created"), "ok", `${product.name} (#${wcId})`);
  return product;
}

export async function markProductDeleted(id) {
  await prisma.product.updateMany({ where: { wcId: Number(id) }, data: { deleted: true, status: "trash" } });
  await logEvent("product:deleted", "ok", `#${id}`);
}
