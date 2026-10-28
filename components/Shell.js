import Link from "next/link";

export default function Shell({ nav, user, children, title = "Affiliates" }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-cosmic-900 text-cosmic-100 lg:fixed lg:inset-y-0 lg:w-60">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-cosmic-200/70">TrueCosmic</div>
            <div className="text-lg font-semibold text-white">{title}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-white/10 hover:text-white">
              {n.label}
            </Link>
          ))}
          <form action="/logout" method="post" className="lg:hidden"><button className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-white/10">Log out</button></form>
        </nav>
        <div className="hidden px-5 py-4 text-xs text-cosmic-200/70 lg:absolute lg:bottom-0 lg:block">
          <div className="mb-2 truncate">{user.email}</div>
          <form action="/logout" method="post"><button className="underline hover:text-white">Log out</button></form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-8 lg:ml-60">{children}</main>
    </div>
  );
}
