import { Redirect, Route, Switch } from 'wouter'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ImportScreen } from './screens/ImportScreen.tsx'
import { BackupScreen, CatalogScreen, HistoryScreen, MoreScreen, PlansScreen, PromptScreen } from './screens/MoreScreens.tsx'
import { ProgramTab } from './screens/ProgramTab.tsx'
import { GlassNav } from './ui/GlassNav.tsx'
import { Button } from './ui/ui.tsx'

function UpdateBanner() {
  // immediate: the app renders after the DB seed, when the window 'load' event has usually already fired.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })
  if (!needRefresh) return null
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-50 flex justify-center px-4">
      <div className="mt-2 flex w-full max-w-md items-center gap-2 rounded-full bg-surface py-2 pr-2 pl-5 shadow-soft">
        <span className="flex-1 text-[15px] font-bold">Neue Version verfügbar</span>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          Später
        </Button>
        <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
          Neu laden
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <UpdateBanner />
      <GlassNav />
      <main>
        <Switch>
          <Route path="/">
            <Redirect to="/strength" replace />
          </Route>
          <Route path="/strength">
            <ProgramTab type="strength" />
          </Route>
          <Route path="/cardio">
            <ProgramTab type="cardio" />
          </Route>
          <Route path="/mobility">
            <ProgramTab type="rehab" />
          </Route>
          {/* Old German paths from the first build. */}
          <Route path="/kraft">
            <Redirect to="/strength" replace />
          </Route>
          <Route path="/reha">
            <Redirect to="/mobility" replace />
          </Route>
          <Route path="/verlauf" component={HistoryScreen} />
          <Route path="/mehr" component={MoreScreen} />
          <Route path="/mehr/import" component={ImportScreen} />
          <Route path="/mehr/prompt" component={PromptScreen} />
          <Route path="/mehr/plaene" component={PlansScreen} />
          <Route path="/mehr/katalog" component={CatalogScreen} />
          <Route path="/mehr/backup" component={BackupScreen} />
          <Route>
            <Redirect to="/strength" replace />
          </Route>
        </Switch>
      </main>
    </>
  )
}
