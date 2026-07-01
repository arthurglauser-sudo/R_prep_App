# Data Handling in R - Exam Prep (course 3,230,1.00)

A static, single-page study tool. No build step, no framework, no server.
Open `index.html` in a browser and it works. Deploy the folder to GitHub Pages
and it works there too. Progress is stored in the browser's localStorage
(per-device, per-browser; clearing site data resets it).

## Files

| File | What it holds |
|------|---------------|
| `index.html` | Page structure (Dashboard, Practice, Review) |
| `styles.css` | HSG light theme: St. Gallen green on white, responsive, accessible |
| `app.js` | View switching, quiz engine, progress tracking, keyboard shortcuts |
| `questions.js` | The question bank: `TOPICS` and `QUESTIONS`. Edit this to add content |

## Running locally

Double-click `index.html`, or from the folder run a tiny server:

```
python3 -m http.server 8000
```

then open http://localhost:8000

## The question schema

Every question is one object appended to the `QUESTIONS` array in `questions.js`:

```js
{
  id: "prog-010",          // unique, "<topicKey>-NNN"
  topic: "prog",           // must match a TOPICS key
  type: "single",          // "tf" | "single" | "multi"
  prompt: "What does `x * 10` return when x is c(1,2,3)?",
  code: "x <- c(1,2,3)\nx * 10",   // OPTIONAL monospace block
  options: ["10 20 30", "60", "Error", "1 2 3 10"],  // omit for "tf"
  answer: 0,               // tf: true/false | single: index | multi: [indices]
  explanation: "Arithmetic is vectorized, so 10 is applied element by element.",
  source: "Lecture 2, vectorization",   // for your own verification
  flagged: true            // OPTIONAL: author was unsure, verify this one
}
```

Topic keys currently defined: `tools, prog, storage, import, nonrect, apis, prep, viz`.

## Growing the bank to ~240 with Claude Code

Work in verified batches, one topic at a time, so errors stay contained.
A good prompt to give Claude Code inside this repo:

> Read questions.js. Add 25 new "prog" (Programming Basics) questions following
> the exact schema, appending to the QUESTIONS array with unique ids continuing
> the numbering. Mix tf, single, and multi types, and include at least 8
> code-comprehension items with a `code` field. Base every question and
> explanation only on standard base R and tidyverse behaviour, set the `source`
> field, and add `flagged: true` to any you are not fully certain about. Do not
> touch index.html, styles.css, or app.js.

Then open the app, review that batch (the `flagged` ones first), fix anything
wrong, and move to the next topic.

## Deploying to GitHub Pages

1. Create a public repo and push these files to the `main` branch.
2. Repo Settings -> Pages -> Source: "Deploy from a branch" -> `main` / `root`.
3. Wait ~1 minute. The site is live at
   `https://<your-username>.github.io/<repo-name>/`.

Any push to `main` redeploys automatically.
