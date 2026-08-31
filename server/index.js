const http = require('http');
const { Server } = require('socket.io');
const { app } = require('./app');

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-document', (docId) => {
    console.log(`Socket ${socket.id} joining doc-${docId}`);
    socket.join(`doc-${docId}`);
  });

  socket.on('edit-document', ({ docId, content }) => {
    console.log(`Socket ${socket.id} editing doc-${docId}:`, content);
    socket.to(`doc-${docId}`).emit('receive-edit', content);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

httpServer.listen(4000, () => console.log('Server running on port 4000'));