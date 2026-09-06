const http = require('http');
const { Server } = require('socket.io');
const { app } = require('./app');

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Track who is in each document: docId -> Map(socketId -> name)
const documentUsers = new Map();

function broadcastPresence(docId) {
  const room = documentUsers.get(docId);
  const users = room
    ? Array.from(room.entries()).map(([id, name]) => ({ id, name }))
    : [];
  io.to(`doc-${docId}`).emit('presence-update', { docId, users });
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-document', ({ docId, name }) => {
    console.log(`Socket ${socket.id} (${name}) joining doc-${docId}`);
    socket.join(`doc-${docId}`);
    socket.data.docId = docId;
    socket.data.name = name;

    if (!documentUsers.has(docId)) documentUsers.set(docId, new Map());
    documentUsers.get(docId).set(socket.id, name);

    broadcastPresence(docId);
  });

  socket.on('leave-document', ({ docId }) => {
    socket.leave(`doc-${docId}`);
    documentUsers.get(docId)?.delete(socket.id);
    broadcastPresence(docId);
  });

  socket.on('edit-document', ({ docId, content }) => {
    console.log(`Socket ${socket.id} editing doc-${docId}:`, content);
    socket.to(`doc-${docId}`).emit('receive-edit', content);
  });

  socket.on('typing', ({ docId, name }) => {
    socket.to(`doc-${docId}`).emit('user-typing', { docId, name });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    const docId = socket.data.docId;
    if (docId && documentUsers.has(docId)) {
      documentUsers.get(docId).delete(socket.id);
      broadcastPresence(docId);
    }
  });
});

httpServer.listen(4000, () => console.log('Server running on port 4000'));