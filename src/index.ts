import  express  from "express";
import cors from "cors"
import { connectDB } from "./config/database";
import { createServer} from "http";
import { Server } from "socket.io";
import Database from "./models/schema";

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


  // join documnet block
  socket.on("join-document", async (documentId: string) => {
  socket.join(documentId);

  let Userdata = await Database.findOne({ documentId });

  if (!Userdata) {
    Userdata = await Database.create({
      documentId,
      content: "This is created by Abhinav Shukla"
    });
  }

  socket.emit("load-content", Userdata.content);      

  console.log(`User joined document ${documentId}`);
});

  socket.on("send-changes", async({ documentId, content }) => {
    socket.to(documentId).emit("receive-changes", content);

    await Database.findOneAndUpdate(
    { documentId },
    { content }
  );

    console.log(content)
  });


  // save data
  socket.on("save-document",async ({documentId , content })=>{
    await Database.findOneAndUpdate( { documentId },{ content })
    console.log("data saved")
  })


  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


httpserver.listen(3000 , "0.0.0.0" ,()=>{
    console.log("Server is listening with websocket on 3000")
})