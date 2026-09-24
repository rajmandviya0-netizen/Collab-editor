import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// ---------- tiny fetch helper ----------
async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || 'Something went wrong')
  return data
}

// ---------- header (shared by every page) ----------
function Header({ onLogout }) {
  return (
    <header className="app-header">
      <span className="brand">Collab Editor</span>
      {onLogout && (
        <button className="btn btn-ghost" onClick={onLogout}>
          Log out
        </button>
      )}
    </header>
  )
}

// ---------- login / signup ----------
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const data = await api(`/${mode}`, { method: 'POST', body: { email, password } })
      if (!data.token) throw new Error('No token received from server')
      onAuth(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="container narrow">
        <div className="card stack">
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" onClick={submit} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setError('')
              setMode(mode === 'login' ? 'signup' : 'login')
            }}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        </div>
      </main>
    </>
  )
}

// ---------- dashboard ----------
function Dashboard({ token, onOpen, onLogout }) {
  const [docs, setDocs] = useState([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await api('/documents', { token })
      setDocs(Array.isArray(data) ? data : data.documents || [])
      setError('')
    } catch (err) {
      setDocs([])
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function create() {
    if (!title.trim()) return
    try {
      await api('/documents', { method: 'POST', token, body: { title, content: '' } })
      setTitle('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    try {
      await api(`/documents/${id}`, { method: 'DELETE', token })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Header onLogout={onLogout} />
      <main className="container">
        <h1>Your documents</h1>

        <div className="row">
          <input
            className="input"
            placeholder="New document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button className="btn" onClick={create}>
            New document
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="stack">
          {docs.length === 0 && !error && (
            <p className="muted">No documents yet. Create one above.</p>
          )}
          {docs.map((d) => (
            <div key={d.id} className="card doc-row">
              <span className="doc-title">{d.title}</span>
              <div className="row">
                <button className="btn" onClick={() => onOpen(d.id)}>
                  Open
                </button>
                <button className="btn btn-danger" onClick={() => remove(d.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}

// ---------- editor (real-time) ----------
function Editor({ token, docId, onBack, onLogout }) {
  const [doc, setDoc] = useState(null)
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('Loading…')
  const socketRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    let active = true

    api(`/documents/${docId}`, { token })
      .then((d) => {
        if (!active) return
        setDoc(d)
        setContent(d.content || '')
        setStatus('Saved')
      })
      .catch((err) => setStatus(err.message))

    const socket = io(API_URL)
    socketRef.current = socket
    socket.emit('join-document', docId)
    socket.on('receive-changes', (incoming) => setContent(incoming))

    return () => {
      active = false
      socket.disconnect()
    }
  }, [docId, token])

  function handleChange(e) {
    const value = e.target.value
    setContent(value)
    socketRef.current?.emit('send-changes', { docId, content: value })

    setStatus('Saving…')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await api(`/documents/${docId}`, {
          method: 'PUT',
          token,
          body: { title: doc?.title, content: value },
        })
        setStatus('Saved')
      } catch (err) {
        setStatus(err.message)
      }
    }, 800)
  }

  return (
    <>
      <Header onLogout={onLogout} />
      <main className="container">
        <div className="row spread">
          <button className="btn btn-ghost" onClick={onBack}>
            Back to documents
          </button>
          <span className="muted">{status}</span>
        </div>
        <h1>{doc?.title || 'Document'}</h1>
        <textarea
          className="input editor"
          value={content}
          onChange={handleChange}
          placeholder="Start typing. Anyone with this document open sees it live."
        />
      </main>
    </>
  )
}

// ---------- root ----------
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [docId, setDocId] = useState(null)

  function handleAuth(t) {
    localStorage.setItem('token', t)
    setToken(t)
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setDocId(null)
  }

  if (!token) return <AuthPage onAuth={handleAuth} />
  if (docId) {
    return <Editor token={token} docId={docId} onBack={() => setDocId(null)} onLogout={logout} />
  }
  return <Dashboard token={token} onOpen={setDocId} onLogout={logout} />
}