import { Link, NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-soft text-accent'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col bg-parchment text-ink">
      <header className="no-print border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-base font-semibold tracking-tight">
            Karakter Oluşturucu{' '}
            <span className="text-accent">D&amp;D 5e</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Karakterlerim
            </NavLink>
            <NavLink to="/olustur" className={navLinkClass}>
              Karakter Oluştur
            </NavLink>
            <NavLink to="/rastgele" className={navLinkClass}>
              Rastgele
            </NavLink>
            <NavLink to="/homebrew" className={navLinkClass}>
              Homebrew
            </NavLink>
            <NavLink to="/icerik" className={navLinkClass}>
              SRD İçeriği
            </NavLink>
            <NavLink to="/hakkinda" className={navLinkClass}>
              Hakkında
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="no-print border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
        <p>
          Bu araç <em>Systems Reference Document 5.1</em> içeriğini{' '}
          <a
            className="underline hover:text-slate-700"
            href="https://creativecommons.org/licenses/by/4.0/legalcode"
            target="_blank"
            rel="noreferrer"
          >
            CC-BY-4.0
          </a>{' '}
          lisansıyla kullanır. Wizards of the Coast ile bağlantılı değildir.
        </p>
      </footer>
    </div>
  )
}
