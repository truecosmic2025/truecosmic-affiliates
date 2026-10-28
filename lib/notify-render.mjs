// Replaces {tag} placeholders; unknown tags are left as-is so typos are visible in test emails
export function render(template, vars) {
  return String(template || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}
