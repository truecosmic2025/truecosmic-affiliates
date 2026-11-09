import NavList from "./NavList";
import Icon from "./Icon";

export default function Shell({ nav, user, children, title = "Affiliates" }) {
  const initial = (user.affiliate?.firstName || user.name || user.email || "?").trim()[0].toUpperCase();
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-gradient-to-b from-cosmic-900 to-[#140b2e] text-cosmic-100 lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_35%,#8b5cf6,#2e1065)] text-sm font-bold text-white ring-2 ring-white/10">TC</span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-cosmic-200/70">TrueCosmic</div>
            <div className="text-base font-semibold text-white">{title}</div>
          </div>
        </div>
        <NavList nav={nav} />
        <form action="/logout" method="post" className="px-3 pb-3 lg:hidden">
          <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10"><Icon name="logout" className="h-4 w-4" />Log out</button>
        </form>
        <div className="mt-auto hidden border-t border-white/10 px-4 py-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">{initial}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-cosmic-100">{user.email}</div>
              <form action="/logout" method="post"><button className="text-xs text-cosmic-200/70 underline hover:text-white">Log out</button></form>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:ml-64">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
