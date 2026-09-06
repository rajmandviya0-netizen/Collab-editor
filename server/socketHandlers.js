// socketHandlers.js
//
// Add this to your existing server/index.js (or import it from there).
// It adds: joining a document "room", tracking who's currently in it,
// broadcasting live content changes, and typing indicators.
//
// Usage in server/index.js:
//   const { setupDocumentSockets } = require('./socketHandlers');
//   setupDocumentSockets(io);

function setupDocumentSockets(io) {
  // In-memory map: documentId -> Map(socketId -> { id, name })
  // This resets if the server restarts — fine for presence, since it's
  // only "who's here right now", not something that needs to persist.
  const documentRooms = new Map();

  function getUsersInDocument(documentId) {
    const room = documentRooms.get(documentId);
    if (!room) return [];
    return Array.from(room.values());
  }

  function broadcastPresence(io, documentId) {
    io.to(documentId).emit("presence-update", {
      documentId,
      users: getUsersInDocument(documentId),
    });
  }

  io.on("connection", (socket) => {
    // ---------- Join a document ----------
    socket.on("join-document", ({ documentId, name }) => {
      socket.join(documentId);
      socket.data.documentId = documentId;
      socket.data.name = name;

      if (!documentRooms.has(documentId)) {
        documentRooms.set(documentId, new Map());
      }
      documentRooms.get(documentId).set(socket.id, { id: socket.id, name });

      broadcastPresence(io, documentId);
    });

    // ---------- Leave a document (switching docs without disconnecting) ----------
    socket.on("leave-document", ({ documentId }) => {
      socket.leave(documentId);
      documentRooms.get(documentId)?.delete(socket.id);
      broadcastPresence(io, documentId);
    });

    // ---------- Live content sync ----------
    socket.on("doc-change", ({ documentId, content }) => {
      // Send to everyone else in the room except the sender
      socket.to(documentId).emit("doc-update", { documentId, content });
    });

    // ---------- Typing indicator ----------
    socket.on("typing", ({ documentId, name }) => {
      socket.to(documentId).emit("user-typing", { documentId, name });
    });

    // ---------- Cleanup on disconnect ----------
    socket.on("disconnect", () => {
      const documentId = socket.data.documentId;
      if (documentId && documentRooms.has(documentId)) {
        documentRooms.get(documentId).delete(socket.id);
        broadcastPresence(io, documentId);
      }
    });
  });
}

module.exports = { setupDocumentSockets };