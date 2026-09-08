import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.tsx'
import UpdatePrompt from './UpdatePrompt.tsx'

const NAV = [
  { to: '/', label: 'Karakterlerim', end: true },
  { to: '/olustur', label: 'Oluştur' },
  { to: '/rastgele', label: 'Rastgele' },
  { to: '/homebrew', label: 'Homebrew' },
  { to: '/icerik', label: 'SRD İçeriği' },
  { to: '/hakkinda', label: 'Hakkında' },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-ink',
  ].join(' ')

/**
 * Uygulama çerçevesi: başlık, gezinme, içerik ve altbilgi.
 *
 * Gezinme altı bağlantı taşıyor; telefonda tek satıra sığmıyor ve yatay kaydırma
 * üretiyordu. Dar ekranda açılır bir menüye dönüşüyor, geniş ekranda satır
 * hâlinde kalıyor — aynı bağlantılar, iki düzen.
 */
export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const menuButton = useRef<HTMLButtonElement>(null)

  // Sayfa değişince menü kendiliğinden kapanmalı; açık kalırsa yeni sayfayı örter.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Escape menüyü kapatır ve odağı açan düğmeye geri verir.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="flex min-h-full flex-col bg-bg text-ink">
      {/*
        Klavye kullanıcısı her sayfada altı gezinme bağlantısını geçmek zorunda
        kalmasın. Yalnızca odaklanınca görünür.
      */}
      <a
        href="#main"
        className="no-print sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
      >
        İçeriğe atla
      </a>

      <header className="no-print sticky top-0 z-30 border-b border-border bg-bg-alt/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl"
          >
            {/* Dar ekranda uzun ad iki satıra sarıyordu; orada kısası yeter. */}
            <span className="hidden sm:inline">Karakter Oluşturucu </span>
            <span className="text-accent">D&amp;D 5e</span>
            <span className="sr-only"> — ana sayfa</span>
          </Link>

          <div className="flex items-center gap-2">
            <nav aria-label="Ana gezinme" className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <ThemeToggle />

            <button
              ref={menuButton}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobil-menu"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-ink lg:hidden"
            >
              {menuOpen ? 'Kapat' : 'Menü'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobil-menu"
            aria-label="Ana gezinme"
            className="border-t border-border bg-surface px-4 py-2 lg:hidden"
          >
            <ul className="mx-auto flex max-w-5xl flex-col gap-0.5">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2.5 text-sm font-medium ${
                        isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="no-print border-t border-border px-4 py-6 text-center text-xs text-faint">
        <p className="mx-auto max-w-2xl">
          Bu araç <em>Systems Reference Document 5.1</em> içeriğini{' '}
          <a
            className="underline hover:text-ink"
            href="https://creativecommons.org/licenses/by/4.0/legalcode"
            target="_blank"
            rel="noreferrer"
          >
            CC-BY-4.0
          </a>{' '}
          lisansıyla kullanır. Wizards of the Coast ile bağlantılı değildir.
        </p>
      </footer>

      <UpdatePrompt />
    </div>
  )
}
