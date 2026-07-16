import { DevComponentsPage } from './design-system/DevComponentsPage'

/**
 * Top-level shell. As of R1, this just renders the design-system
 * verification page -- real routing/screens (product note view/edit,
 * Compliance, Create, etc.) get built starting R3. See rebuild/ROADMAP.md.
 */
function App() {
  return <DevComponentsPage />
}

export default App
