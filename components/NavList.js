"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

// Sidebar links with the current page highlighted. Items may carry an icon and a section heading.
export default function NavList({ nav }) {
  const path = usePathname();
  const root = nav[0]?.href;
  const isActive = (href) => (href === root ? path === href : path === href || path.startsWith(`${href}/`));
  let lastSection = null;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {nav.map((n) => {
        const heading = n.section && n.section !== lastSection ? n.section : null;
        lastSection = n.section || lastSection;
        const active = isActive(n.href);
        return (
          <div key={n.href} className="contents">
            {heading && <div className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cosmic-200/60 lg:block">{heading}</div>}
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white text-cosmic-900 font-semibold shadow-sm" : "text-cosmic-100 hover:bg-white/10 hover:text-white"}`}
            >
              {n.icon && <Icon name={n.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? "text-cosmic-600" : "text-cosmic-200/80"}`} />}
              <span>{n.label}</span>
              {n.badge ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-cosmic-100 text-cosmic-700" : "bg-white/15 text-white"}`}>{n.badge}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
