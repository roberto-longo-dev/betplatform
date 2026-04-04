export default function Home() {
  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>betplatform</h1>
      <p>Backend-focused portfolio project. The UI is intentionally minimal.</p>
      <ul>
        <li>
          <a href="http://localhost:3001/docs" target="_blank" rel="noopener noreferrer">
            API Documentation (Swagger UI)
          </a>
        </li>
        <li>
          <a href="http://localhost:3001/health" target="_blank" rel="noopener noreferrer">
            Health Check
          </a>
        </li>
      </ul>
    </main>
  )
}
