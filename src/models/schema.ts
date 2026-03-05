import mongoose , {Schema} from "mongoose";

const noteSchema: Schema = new Schema(
  {
    documentId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true } 
);


const Database = mongoose.model("Note", noteSchema);

export default Database;