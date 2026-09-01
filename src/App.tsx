import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import HomePage from './routes/HomePage.tsx'
import AboutPage from './routes/AboutPage.tsx'

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
          <Route path="hakkinda" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
