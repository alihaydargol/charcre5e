import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { useHomebrewStore } from './state/homebrewStore.ts'
import './index.css'

/**
 * Homebrew içerik ilk render'dan önce registry'ye kurulur.
 *
 * Store oluşturulurken kurulum yapılıyor; bu satır modülün yüklenmesini —
 * dolayısıyla kurulumu — garanti eder. Aksi hâlde homebrew yalnızca /homebrew
 * sayfası açıldığında yüklenirdi ve sihirbaz kullanıcının kendi ırkını
 * görmezdi.
 */
useHomebrewStore.getState()

const container = document.getElementById('root')
if (!container) {
  throw new Error('#root öğesi bulunamadı.')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
