import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

async function run() {
  const model = genAI.getGenerativeModel({ model: modelName });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await model.generateContent("Reply with a short greeting.");
      console.log(result.response.text());
      return;
    } catch (error) {
      const isBusy = /503|high demand|service unavailable/i.test(error.message || "");
      if (!isBusy || attempt === 2) {
        console.error("Gemini test failed:", error.message);
        process.exitCode = 1;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

run();
