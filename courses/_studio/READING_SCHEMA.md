# Readable course format (no video)

A readable course is a short free course made of **text lessons** (LearnWorlds Ebook activities) plus a quiz and a
certificate. It is built from one Fibre2Fashion article, and much faster to make than the video courses.

```
courses/<slug>/content.json         course settings, lesson list, quiz, glossary
courses/<slug>/lessons/01-<x>.md    one Markdown file per lesson
```
Build: `python courses/_studio/reading.py <slug>` (`--check` validates only; `--no-card` skips the card image).
Fetch articles first: they are in `articles/<id>-<slug>.json` (`markdown` holds the article text).

## Writing rules

* **Facts come from the source article.** Rewrite, reorder and explain; never copy long passages word for word.
  Do not invent statistics, companies, studies, brands, dates or quotes. Well-established textbook knowledge may be added
  only where it makes a point clearer (a definition, a simple example), and it must be correct.
* Teach, don't report: turn the article into a learning path. Each lesson answers one clear question and builds on the last.
  Explain terms the first time they appear. Use short paragraphs (2-4 sentences), lists and the occasional table.
* British English (fibre, colour, optimise, organisation). Plain, friendly, professional voice ("you", "we").
  No hype, no emojis, no exclamation marks.
* Readers are on phones as well as desktops: keep paragraphs short and tables to at most 4 columns.

## content.json

```json
{
  "format": "reading",
  "slug": "fibre-testing-quality-control",
  "title": "Course title, 2-9 words",
  "subtitle": "One-line promise, 5-18 words",
  "card_description": "Shown on the course card, 10-30 words",
  "seo_description": "60-155 characters; the course page hero shows it",
  "level": "Beginner",
  "categories": ["fibre-fundamentals"],
  "card_icon": "microscope",
  "card_topic": "Fibre testing",
  "author_name": "Fibre2Fashion Institute",
  "source": { "title": "exact article title", "url": "article url", "authors": "author name as credited", "published": "Oct 2026" },
  "outcomes": ["4-5 outcomes, each 4-14 words, starting with a verb"],
  "audience": "Who it is for, 5-30 words",
  "about": "Course page description, 60-110 words. Mention it is based on the Fibre2Fashion article by <author>.",
  "lessons": [ { "title": "2-7 words", "file": "01-short-name.md" } ],
  "quiz": [ ... ],
  "glossary": [ { "term": "Micronaire", "def": "3-25 words" } ]
}
```
* `categories`: from `fibre-fundamentals`, `technical-textiles`, `sustainable-textiles`, `apparel-manufacturing`, `fashion-design`, `sourcing`, `merchandising`.
  The first one decides where the course shows on the home page.
* `card_icon`: a name from `courses/_studio/icons.txt`. `card_topic`: 1-3 words printed on the card.
* 3-5 lessons (set `"micro": true` for a short article: then 2-3 lessons, 250+ words each, 5-6 questions).
* 5-10 glossary terms. They are printed at the end of the last lesson.

## Lesson Markdown (lessons/NN-name.md)

400-1000 words per lesson (about 2-5 minutes of reading). Only this subset is supported:

```markdown
# Lesson title                       <- first line, exactly the lesson title from content.json
Opening paragraph: why this lesson matters, in 2-3 sentences.

## Section heading
Paragraph text with **bold key terms** and *italics*.

### Smaller heading
- Bullet item (one level only, no nesting)
1. Numbered step

| Column | Column |
|---|---|
| cell | cell |

> **Key idea:** one short callout paragraph (shown as a tinted box). Use 1-2 per lesson at most.

## Key takeaways                      <- required, last section of every lesson
- 3-5 bullets
```
No images, links, code, nested lists or `####` headings. The "Lesson N of M · X min read" line, the source credit, the
key terms (last lesson) and the "What next" note are added by the build.

## Quiz (8-10 questions; pass mark 70 %)

```json
{ "type": "mc", "q": "4-30 words", "options": ["exactly 4 options, 1-14 words each"], "answer": 1, "feedback": "4-30 words, explains the right answer" }
{ "type": "tf", "q": "statement, 4-30 words", "answer": true, "feedback": "..." }
{ "type": "ma", "q": "... (select all that apply)", "options": ["4-5 options"], "answers": [0, 2], "feedback": "..." }
```
Mostly `mc`, 1-2 `tf`, at most 1 `ma`. Every answer must be taught in the lessons. Test understanding, not trivia; wrong
options must be plausible but clearly wrong according to the course. Spread the correct `mc` positions (0-3) evenly.
