import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import './Sidebar.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState([])
  const [search, setSearch] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [activeDoc, setActiveDoc] = useState(null)
  const [content, setContent] = useState('')
  const [collaborators, setCollaborators] = useState([])
  const [typingUser, setTypingUser] = useState(null)
  const [isViewOnly, setIsViewOnly] = useState(false)
  const [pendingViewId, setPendingViewId] = useState(() => {
    const match = window.location.pathname.match(/^\/view\/(\d+)$/)
    return match ? match[1] : null
  })

  const socketRef = useRef(null)
  const saveTimeout = useRef(null)
  const typingTimeout = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const endpoint = isLogin ? '/login' : '/signup'
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      if (isLogin) {
        setToken(data.token)
      } else {
        setIsLogin(true)
        setError('Signed up! Now log in.')
      }
    } catch (err) {
      setError('Could not reach server')
    }
  }

  async function fetchDocuments() {
    const res = await fetch(`${API_URL}/documents`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setDocuments(data)
  }

  useEffect(() => {
    if (token) {
      fetchDocuments()
      socketRef.current = io(API_URL)
    }
    return () => {
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [token])

  // If the person arrived via a "Copy view link" URL, open that document
  // automatically once they're logged in (view-only mode).
  useEffect(() => {
    if (!token || !pendingViewId || !socketRef.current) return

    async function openFromLink() {
      try {
        const res = await fetch(`${API_URL}/documents/${pendingViewId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) {
          alert("You don't have access to this document. Ask the owner to share it with you.")
          window.history.replaceState({}, '', '/')
          setPendingViewId(null)
          return
        }
        const doc = await res.json()
        openDocument(doc, { viewOnly: true })
      } catch (err) {
        window.history.replaceState({}, '', '/')
        setPendingViewId(null)
      }
    }

    openFromLink()
    setPendingViewId(null)
  }, [token, pendingViewId])

  async function createDocument(e) {
    e.preventDefault()
    if (!newTitle.trim()) return

    await fetch(`${API_URL}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: newTitle })
    })
    setNewTitle('')
    fetchDocuments()
  }

  async function deleteDocument(id, e) {
    e.stopPropagation()
    await fetch(`${API_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchDocuments()
    if (activeDoc?.id === id) closeDocument()
  }

  function openDocument(doc, options = {}) {
    // leave whatever document we were previously in
    if (activeDoc) {
      socketRef.current.emit('leave-document', { docId: activeDoc.id })
    }

    setActiveDoc(doc)
    setContent(doc.content || '')
    setCollaborators([])
    setTypingUser(null)
    setIsViewOnly(!!options.viewOnly)
    window.history.replaceState({}, '', `/view/${doc.id}`)

    socketRef.current.emit('join-document', { docId: doc.id, name: email })

    socketRef.current.off('receive-edit')
    socketRef.current.on('receive-edit', (newContent) => {
      setContent(newContent)
    })

    socketRef.current.off('presence-update')
    socketRef.current.on('presence-update', ({ docId, users }) => {
      if (docId === doc.id) setCollaborators(users)
    })

    socketRef.current.off('user-typing')
    socketRef.current.on('user-typing', ({ docId, name }) => {
      if (docId !== doc.id || name === email) return
      setTypingUser(name)
      clearTimeout(typingTimeout.current)
      typingTimeout.current = setTimeout(() => setTypingUser(null), 2000)
    })
  }

  function closeDocument() {
    if (activeDoc) {
      socketRef.current.emit('leave-document', { docId: activeDoc.id })
    }
    setActiveDoc(null)
    setCollaborators([])
    setTypingUser(null)
    setIsViewOnly(false)
    window.history.replaceState({}, '', '/')
  }

  async function shareDocument() {
    const friendEmail = window.prompt("Enter your friend's email to share this document:")
    if (!friendEmail) return

    try {
      const res = await fetch(`${API_URL}/documents/${activeDoc.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: friendEmail })
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Could not share document')
        return
      }

      alert(`Document shared with ${data.sharedWith}! They'll see it in their sidebar next time they log in.`)
    } catch (err) {
      alert('Could not reach server')
    }
  }

  function copyViewLink() {
    const link = `${window.location.origin}/view/${activeDoc.id}`
    navigator.clipboard.writeText(link)
    alert('View-only link copied! Anyone logged in can open it with this link, but cannot edit.')
  }

  function handleContentChange(e) {
    if (isViewOnly) return
    const newContent = e.target.value
    setContent(newContent)
    socketRef.current.emit('edit-document', {
      docId: activeDoc.id,
      content: newContent
    })
    socketRef.current.emit('typing', { docId: activeDoc.id, name: email })
    scheduleSave({ title: activeDoc.title, content: newContent })
  }

  function handleTitleChange(e) {
    if (isViewOnly) return
    const title = e.target.value
    setActiveDoc((prev) => ({ ...prev, title }))
    setDocuments((prev) =>
      prev.map((d) => (d.id === activeDoc.id ? { ...d, title } : d))
    )
    scheduleSave({ title, content })
  }

  // Debounced auto-save — fires 600ms after the user stops typing
  function scheduleSave(patch) {
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      await fetch(`${API_URL}/documents/${activeDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      })
    }, 600)
  }

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  )

  // ---------------- Logged-in: document open (full-screen editor, no sidebar) ----------------
  if (token && activeDoc) {
    return (
      <div className="editor-fullscreen">
        <div className="topbar">
          <button className="back-btn" onClick={closeDocument}>
            ← All documents
          </button>

          <div className="title-wrap">
            <input
              className="doc-title"
              value={activeDoc.title}
              onChange={handleTitleChange}
              readOnly={isViewOnly}
            />
            <div className="meta">
              {isViewOnly
                ? 'View only'
                : typingUser
                ? `${typingUser} is typing…`
                : 'All changes saved'}
            </div>
          </div>

          <div className="presence">
            <div className="avatars">
              {collaborators
                .filter((c) => c.name !== email)
                .map((c) => (
                  <div key={c.id} className="avatar live" title={c.name}>
                    {c.name?.[0]?.toUpperCase()}
                  </div>
                ))}
            </div>
            {!isViewOnly && (
              <>
                <button className="link-btn" onClick={copyViewLink}>
                  Copy view link
                </button>
                <button className="share-btn" onClick={shareDocument}>
                  Share
                </button>
              </>
            )}
          </div>
        </div>

        <div className="editor-area editor-area-full">
          <textarea
            className="full-textarea"
            value={content}
            onChange={handleContentChange}
            readOnly={isViewOnly}
            placeholder="Start writing here — everyone with access sees your changes instantly."
          />
        </div>
      </div>
    )
  }

  // ---------------- Logged-in: document list (sidebar + empty state) ----------------
  if (token) {
    return (
      <div className="dash-shell">
        <aside className="sidebar">
          <div className="brand">Collab Editor</div>

          <form onSubmit={createDocument} className="new-doc-form">
            <input
              type="text"
              placeholder="New document title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="submit">+ Create</button>
          </form>

          <div className="search">
            <input
              placeholder="Search documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="doc-list">
            {filteredDocs.length === 0 && (
              <div className="doc-list-empty">No documents yet</div>
            )}
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="doc-item"
                onClick={() => openDocument(doc)}
              >
                <span className="dot" />
                <span className="name">{doc.title || 'Untitled document'}</span>
                <button className="delete-btn" onClick={(e) => deleteDocument(doc.id, e)}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="sidebar-foot">
            Signed in as {email}
            <button className="logout-link" onClick={() => setToken('')}>
              Log out
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="empty-state">
            <p>Select a document, or create a new one to start writing.</p>
          </div>
        </main>
      </div>
    )
  }

  // ---------------- Login / Signup view ----------------
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Collab Editor</div>
        <h1 className="auth-heading">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="auth-subheading">
          {isLogin
            ? 'Log in to keep writing with your team.'
            : 'Start writing and collaborating in real time.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
          <button type="submit" className="auth-submit">
            {isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        <button onClick={() => setIsLogin(!isLogin)} className="auth-switch">
          {isLogin ? "Need an account? Sign up" : 'Have an account? Log in'}
        </button>
      </div>
    </div>
  )
}

export default App