const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const axios    = require("axios");
const cheerio  = require("cheerio");
const cron     = require("node-cron");
require("dotenv").config();

/* ---- quick Jewish keyword filter ---- */
const jewishKeywords = [
  "jewish", "jews", "judaism", "judaic", "hebrew", "yiddish",
  "israel", "zionism", "antisemit", "holocaust",
  "rabbi", "talmud", "midrash", "kabbalah",
  "sephard", "ashkenaz", "synagogue"
];

function looksJewish(text) {
  const lower = text.toLowerCase();
  return jewishKeywords.some(word => lower.includes(word));
}

/* ---- basic server + Mongo setup ---- */
const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  genre: [String],
  publisher: String,
  releaseDate: Date,
  blurb: String,
  coverUrl: String,
  status: { type: String, default: "approved" }
});

const Book = mongoose.model("Book", bookSchema);

/* ---- public & admin routes ---- */
app.get("/", (req, res) => res.send("Jewish Book Database backend is live."));

app.get("/books", async (req, res) => {
  const { search, genre, publisher } = req.query;
  const query = { status: "approved" };
  if (search)    query.title     = new RegExp(search, "i");
  if (genre)     query.genre     = genre;
  if (publisher) query.publisher = publisher;
  res.json(await Book.find(query));
});

app.post("/submit", async (req, res) => {
  try {
    await new Book({ ...req.body, status: "pending" }).save();
    res.status(201).json({ message: "Book submitted for review." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/admin/pending", async (_req, res) =>
  res.json(await Book.find({ status: "pending" }))
);

app.post("/admin/approve/:id", async (req, res) => {
  await Book.findByIdAndUpdate(req.params.id, { status: "approved" });
  res.json({ message: "Book approved." });
});

/* ---- web crawler ---- */
const crawlSite = async (url, selectors, publisherName) => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const books = [];

    $(selectors.entry).each((_, el) => {
      const title        = $(el).find(selectors.title ).text().trim();
      const author       = $(el).find(selectors.author).text().trim();
      const blurb        = $(el).find(selectors.blurb ).text().trim();
      const coverUrl     = $(el).find(selectors.cover ).attr("src");
      const releaseDate  = new Date($(el).find(selectors.date).text().trim());

      // --- keyword filter BEFORE saving/pushing ---
      const combined = `${title} ${blurb} ${publisherName}`;
      if (!looksJewish(combined)) return;   // skip non-Jewish books

      books.push({ title, author, blurb, coverUrl, releaseDate, publisher: publisherName });
    });

    // de-dupe & store in Mongo
    for (const b of books) {
      const exists = await Book.findOne({ title: b.title, author: b.author });
      if (!exists) await new Book({ ...b, status: "pending" }).save();
    }

    console.log(`Scraped ${books.length} Jewish-relevant books from ${publisherName}`);
  } catch (err) {
    console.error(`Crawler error (${publisherName}):`, err.message);
  }
};

const runCrawler = async () => {
  await crawlSite(
    "https://example.com/new-jewish-books",
    {
      entry : ".book-entry",
      title : ".title",
      author: ".author",
      blurb : ".description",
      cover : "img",
      date  : ".date"
    },
    "Sample Publisher"
  );
};

app.get("/crawl/sample-publisher", async (_req, res) => {
  await runCrawler();
  res.json({ message: "Crawler run complete." });
});

/* ---- daily schedule ---- */
cron.schedule("0 3 * * *", () => {
  console.log("Running daily crawler…");
  runCrawler();
});

/* ---- boot ---- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
