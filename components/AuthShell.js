export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cosmic-900 via-[#2a1660] to-[#0b1026] px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center text-white">
          <div className="text-sm uppercase tracking-[0.3em] text-cosmic-200">TrueCosmic Academy</div>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-cosmic-100/80">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
