import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import HomePage from './routes/HomePage.tsx'

/**
 * İçerik sayfaları ayrı chunk olarak yüklenir. Bunlar SRD veri katmanını
 * (registry) import ettiği için, ana sayfaya gelen biri onlarca kilobayt oyun
 * verisini boşuna indirmez.
 */
const WizardPage = lazy(() => import('./features/wizard/WizardPage.tsx'))
const GeneratePage = lazy(() => import('./features/generate/GeneratePage.tsx'))
const CharacterSheetPage = lazy(() => import('./features/sheet/CharacterSheetPage.tsx'))
const LevelUpPage = lazy(() => import('./features/levelup/LevelUpPage.tsx'))
const HomebrewPage = lazy(() => import('./features/homebrew/HomebrewPage.tsx'))
const ContentPage = lazy(() => import('./routes/ContentPage.tsx'))
const AboutPage = lazy(() => import('./routes/AboutPage.tsx'))

/**
 * GitHub Pages statik dosya sunar ve bilinmeyen yollarda 404 döner; bu yüzden
 * BrowserRouter yerine HashRouter kullanıyoruz. Böylece derin bağlantılar
 * (#/olustur gibi) sunucu yapılandırması gerektirmeden çalışır.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route
            path="olustur"
            element={
              <Suspense fallback={<PageLoading />}>
                <WizardPage />
              </Suspense>
            }
          />
          <Route
            path="rastgele"
            element={
              <Suspense fallback={<PageLoading />}>
                <GeneratePage />
              </Suspense>
            }
          />
          <Route
            path="homebrew"
            element={
              <Suspense fallback={<PageLoading />}>
                <HomebrewPage />
              </Suspense>
            }
          />
          <Route
            path="karakter/:id"
            element={
              <Suspense fallback={<PageLoading />}>
                <CharacterSheetPage />
              </Suspense>
            }
          />
          <Route
            path="seviye/:id"
            element={
              <Suspense fallback={<PageLoading />}>
                <LevelUpPage />
              </Suspense>
            }
          />
          <Route
            path="icerik"
            element={
              <Suspense fallback={<PageLoading />}>
                <ContentPage />
              </Suspense>
            }
          />
          <Route
            path="hakkinda"
            element={
              <Suspense fallback={<PageLoading />}>
                <AboutPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

function PageLoading() {
  return (
    <p role="status" className="text-sm text-slate-500">
      Yükleniyor…
    </p>
  )
}
