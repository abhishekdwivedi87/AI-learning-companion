import mongoose from "mongoose";

const NotesSchema = new mongoose.Schema({
  originalText: String,
  summary: String,
  embedding: { type: [Number] },
  sourceName: String,
  isChunk: { type: Boolean, default: false },
  sourceNoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Notes" },
  chunkIndex: Number,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Notes", NotesSchema);
