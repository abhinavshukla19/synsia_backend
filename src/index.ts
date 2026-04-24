import express from "express"
import cors from "cors"
import { createServer } from "http"
import { Server } from "socket.io"
import { connectDB } from "./config/database"
import Database from "./models/schema"

const PORT = process.env.PORT || 3000

// ============================================
// STEP 1: Express setup
// ============================================
const app = express()
app.use(express.json())
app.use(cors())

connectDB()

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date() })
})

// ============================================
// STEP 2: HTTP + Socket.IO server
// ============================================
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: { origin: "*" },
})

// ============================================
// STEP 3: Presence tracking
// ============================================
type User = {
  id: string
  name: string
  color: string
}

const documentUsers = new Map<string, Map<string, User>>()

function getUsersInDocument(documentId: string): User[] {
  const usersMap = documentUsers.get(documentId)
  if (!usersMap) return []
  return Array.from(usersMap.values())
}

function broadcastUsers(documentId: string) {
  const users = getUsersInDocument(documentId)
  io.to(documentId).emit("users-update", users)
}

// ============================================
// STEP 4: Socket.IO events
// ============================================
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id)

  let currentDocumentId: string | null = null
  let currentUserId: string | null = null

  // --------------------------------------------
  // Join document
  // --------------------------------------------
  socket.on("join-document", async ({ documentId, user }: { documentId: string; user: User }) => {
    if (!documentId?.trim() || !user) return

    const docId = documentId.trim()
    socket.join(docId)
    currentDocumentId = docId
    currentUserId = user.id

    if (!documentUsers.has(docId)) {
      documentUsers.set(docId, new Map())
    }
    documentUsers.get(docId)!.set(socket.id, user)

    const doc = await Database.findOne({ documentId: docId })
    socket.emit("load-content", doc?.content ?? "")

    broadcastUsers(docId)

    console.log(`📄 ${user.name} joined: ${docId} (${getUsersInDocument(docId).length} users)`)
  })

  // --------------------------------------------
  // Live text sync
  // --------------------------------------------
  socket.on("send-changes", ({ documentId, content }) => {
    if (!documentId?.trim()) return
    socket.to(documentId.trim()).emit("receive-changes", content)
  })

  // --------------------------------------------
  // Live cursor broadcast
  // --------------------------------------------
  socket.on("cursor-move", ({ documentId, userId, x, y }) => {
    if (!documentId?.trim() || !userId) return
    socket.to(documentId.trim()).emit("cursor-move", { userId, x, y })
  })

  socket.on("cursor-leave", ({ documentId, userId }) => {
    if (!documentId?.trim() || !userId) return
    socket.to(documentId.trim()).emit("cursor-leave", { userId })
  })

  // --------------------------------------------
  // Save document
  // --------------------------------------------
  socket.on("save-document", async ({ documentId, content }) => {
    if (!documentId?.trim()) return
    if (typeof content !== "string") return

    try {
      await Database.findOneAndUpdate(
        { documentId: documentId.trim() },
        { content },
        { upsert: true, setDefaultsOnInsert: true }
      )
      console.log(`💾 Saved: ${documentId} (${content.length} chars)`)
      socket.emit("save-success")
    } catch (error) {
      console.error("❌ Save failed:", error)
      socket.emit("save-error")
    }
  })

  // --------------------------------------------
  // Disconnect
  // --------------------------------------------
  socket.on("disconnect", () => {
    console.log("👋 User disconnected:", socket.id)

    if (currentDocumentId) {
      const usersMap = documentUsers.get(currentDocumentId)
      if (usersMap) {
        usersMap.delete(socket.id)
        if (usersMap.size === 0) {
          documentUsers.delete(currentDocumentId)
        } else {
          broadcastUsers(currentDocumentId)
        }
      }
      if (currentUserId) {
        socket.to(currentDocumentId).emit("cursor-leave", { userId: currentUserId })
      }
    }
  })
})

// ============================================
// STEP 5: Start server
// ============================================
httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
})