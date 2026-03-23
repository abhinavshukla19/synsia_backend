import  express  from "express";
import cors from "cors"
import { connectDB } from "./config/database";
import { createServer} from "http";
import { Server } from "socket.io";
import Database from "./models/schema";
const PORT = process.env.PORT || 3000
const app=express()
app.use(express.json())
app.use(cors())

connectDB();

// http  server created
const httpserver=createServer(app)

// connect socket
const io=new Server(httpserver , {
  cors: {
    origin: "*",
  }},)

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const hasMeaningfulContent = (content: unknown) =>
    typeof content === "string" && content.trim().length > 0

  // join documnet block
  socket.on("join-document", async (rawId: string) => {
  const documentId = rawId.trim()
  if (!documentId) return

  socket.join(documentId);

  const Userdata = await Database.findOne({ documentId })
  socket.emit("load-content", Userdata?.content ?? "");      

  console.log(`User joined document ${documentId}`);
});

  socket.on("send-changes", ({ documentId: rawId, content }) => {
    const documentId = rawId.trim()
    if (!documentId) return
    socket.to(documentId).emit("receive-changes", content);
  });


  // save data
  socket.on("save-document",async ({documentId: rawId , content })=>{
    if (!hasMeaningfulContent(content)) return;

    const documentId = rawId.trim()
    if (!documentId) return

    await Database.findOneAndUpdate(
      { documentId },
      { content },
      { upsert: true, setDefaultsOnInsert: true }
    )
    console.log("data saved")
  })


  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
    time: new Date()
  });
});


httpserver.listen(Number(PORT), "0.0.0.0", () => {
  console.log("Server is listening on port", PORT)
})