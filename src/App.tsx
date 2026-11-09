export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <img src="/brand/logo.png" alt="Verum — industrial diagnostic intelligence" height={72} />
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar" />
        <main className="main" />
      </div>
      <footer className="honesty-bar" role="note">
        <strong>Advisory only.</strong> A human decides. No automatic action is authorised.
      </footer>
    </div>
  )
}
