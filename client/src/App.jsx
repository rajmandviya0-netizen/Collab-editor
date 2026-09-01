import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [activeDoc, setActiveDoc] = useState(null)
  const [content, setContent] = useState('')
  const socketRef = useRef(null)

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

  async function deleteDocument(id) {
    await fetch(`${API_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchDocuments()
  }

  function openDocument(doc) {
    setActiveDoc(doc)
    setContent(doc.content || '')

    socketRef.current.emit('join-document', doc.id)

    socketRef.current.off('receive-edit')
    socketRef.current.on('receive-edit', (newContent) => {
      setContent(newContent)
    })
  }

  function handleContentChange(e) {
    const newContent = e.target.value
    setContent(newContent)
    socketRef.current.emit('edit-document', {
      docId: activeDoc.id,
      content: newContent
    })
  }

  async function saveAndClose() {
    await fetch(`${API_URL}/documents/${activeDoc.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: activeDoc.title, content })
    })
    setActiveDoc(null)
    fetchDocuments()
  }

  if (token && activeDoc) {
    return (
      <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <button onClick={saveAndClose} style={{ marginBottom: 10 }}>
          ← Save &amp; Back
        </button>
        <h1>{activeDoc.title}</h1>
        <textarea
          value={content}
          onChange={handleContentChange}
          style={{ width: '100%', height: 400, padding: 12, fontSize: 16 }}
        />
      </div>
    )
  }

  if (token) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', fontFamily: 'sans-serif' }}>
        <h1>My Documents</h1>

        <form onSubmit={createDocument} style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="New document title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ padding: 8, width: '70%' }}
          />
          <button type="submit" style={{ padding: 8, marginLeft: 8 }}>
            Create
          </button>
        </form>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {documents.map((doc) => (
            <li
              key={doc.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid #ccc'
              }}
            >
              <span
                onClick={() => openDocument(doc)}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                {doc.title}
              </span>
              <button onClick={() => deleteDocument(doc.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 300, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>{isLogin ? 'Login' : 'Sign Up'}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <button type="submit" style={{ width: '100%', padding: 8 }}>
          {isLogin ? 'Log In' : 'Sign Up'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={() => setIsLogin(!isLogin)} style={{ marginTop: 10 }}>
        {isLogin ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </div>
  )
}

export default App