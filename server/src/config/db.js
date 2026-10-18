import mongoose from "mongoose";

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

export default connectDB;