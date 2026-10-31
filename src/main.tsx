import '@fontsource-variable/manrope'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { db } from './db/db.ts'
import { ensureSeed } from './db/seed.ts'
import './index.css'

async function requestPersistentStorage() {
  // Asks the browser not to evict IndexedDB under storage pressure (granted automatically for installed PWAs on iOS).
  if (!navigator.storage?.persist) return
  const persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist())
  await db.meta.put({ key: 'storage_persisted', value: persisted })
}

const root = createRoot(document.getElementById('root')!)

ensureSeed(db)
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    void requestPersistentStorage()
  })
  .catch((e: unknown) => {
    root.render(
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Datenbank konnte nicht geöffnet werden</h1>
        <p>{e instanceof Error ? e.message : String(e)}</p>
      </div>,
    )
  })
