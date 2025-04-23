const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schema
const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  genre: [String],
  publisher: String,
  releaseDate: Date,
  blurb: String,
  coverUrl: String,
  status: { type: String, default: "approved" },
});

const Book = mongoose.model("Book", bookSchema);

// Routes
app.get("/", (req, res) => res.send("Jewish Book Database backend is live."));

app.get("/books", async (req, res) => {
  const { search, genre, publisher } = req.query;
  let query = { status: "approved" };
  if (search) query.title = new RegExp(search, "i");
  if (genre) query.genre = genre;
  if (publisher) query.publisher = publisher;
  const books = await Book.find(query);
  res.json(books);
});

app.post("/submit", async (req, res) => {
  try {
    const book = new Book({ ...req.body, status: "pending" });
    await book.save();
    res.status(201).json({ message: "Book submitted for review." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/admin/pending", async (req, res) => {
  const pending = await Book.find({ status: "pending" });
  res.json(pending);
});

app.post("/admin/approve/:id", async (req, res) => {
  await Book.findByIdAndUpdate(req.params.id, { status: "approved" });
  res.json({ message: "Book approved." });
});

// Web crawler logic (sample)
const crawlSite = async (url, selectors, publisherName) => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const books = [];

    $(selectors.entry).each((i, el) => {
      const title = $(el).find(selectors.title).text().trim();
      const author = $(el).find(selectors.author).text().trim();
      const blurb = $(el).find(selectors.blurb).text().trim();
      const coverUrl = $(el).find(selectors.cover).attr("src");
      const releaseDate = new Date($(el).find(selectors.date).text().trim());

      books.push({ title, author, publisher: publisherName, blurb, coverUrl, releaseDate });
    });

    for (const b of books) {
      const exists = await Book.findOne({ title: b.title, author: b.author });
      if (!exists) {
        await new Book({ ...b, status: "pending" }).save();
      }
    }

    console.log(`Scraped ${books.length} books from ${publisherName}`);
  } catch (err) {
    console.error(`Crawler error (${publisherName}):`, err.message);
  }
};

const runCrawler = async ()
