# Course content format (courses/<slug>/content.json)

One JSON file describes a whole free mini-course. `build.py` turns it into the videos, PDF guide,
quiz import file, course card and LearnWorlds copy.

Slides are 1920 x 1080 and are read on phones too, so **respect the word limits**: too much text breaks the layout.
British English (fibre, colour, optimise). Plain, friendly teaching voice. `**bold**` highlights a few key words in blue.
Facts must come from the source article. Well-established textbook knowledge may be added
only where it helps (e.g. a worked calculation), and must be correct. Never invent statistics, companies or claims.

## Top level

```json
{
  "slug": "yarn-testing-essentials",
  "title": "Course title (max 9 words)",
  "subtitle": "One-line promise (max 18 words)",
  "card_description": "Shown on the course card (max 30 words)",
  "label": "40 min · Online",            // LearnWorlds card label: duration · mode
  "level": "Beginner",
  "categories": ["fibre-fundamentals"],   // LearnWorlds category tags
  "author_name": "Fibre2Fashion Institute",
  "source": { "title": "...", "url": "...", "authors": "Dr Lipsa Mohapatra (NIFT Bhubaneswar)", "published": "Oct 2026" },
  "outcomes": ["4-5 learning outcomes, each max 14 words, starting with a verb"],
  "audience": "Who it is for (max 30 words)",
  "about": "Course page description, 60-110 words",
  "lessons": [ { "title": "max 6 words", "sub": "max 14 words", "scenes": [ ... ] } ],
  "quiz": [ ... ],
  "glossary": [ { "term": "Tex", "def": "max 25 words" } ]
}
```

5-6 lessons. Each lesson has 6-9 scenes and **starts with an `opener`**. The last lesson ends with a `recap` then a `closing`.
Every scene has `"say"`: the narration / transcript for that slide, 1-3 sentences, max 60 words, which adds to what is on screen rather than reading it out.
Aim for 2-4 minutes of video per lesson (about 25-45 minutes for the whole course with reading and the quiz).

## Scene types (field limits in words)

| type | fields | reveal |
|---|---|---|
| `opener` | `title` (6), `sub` (16) | 1 frame. The "Lesson N of M" label is added automatically |
| `cards` | `title` (9), `cols` 2/3/4, `items`: [{`icon`, `h` (5), `p` (22)}] x 2-6 | one card per step |
| `list` | `title` (9), `numbered` true/false, optional `lead` (25), `items`: [{`t` (14), optional `sub` (18), optional `icon`}] x 3-6 | one item per step |
| `focus` | `icon`, `h` (6), `p` (40), `label` (3, e.g. "Examples"), `points`: [{`t` (22), optional `icon`}] x 2-4, optional `note` (30) | left side plus first point, then one point per step; `note` shows with the last point |
| `chips` | `title` (9), optional `lead` (25), `chips`: [{`icon`, `t` (3)}] x 3-8, optional `note` (30) | chips at once, then `note` |
| `compare` | `title` (9), `left` {`h` (4), `items` [(10)] x 3-5}, `right` {same} | left, then right |
| `shift` | optional `title` (9), `from` (4), `to` (4), optional `p` (30) | 1 frame |
| `statement` | `big` (22), optional `small` (40) | 1 frame |
| `definition` | `tag` (e.g. "Definition"), `big` (45) | 1 frame |
| `stack` | `title` (9), `layers` bottom-to-top: [{`icon`, `h` (4), `p` (16)}] x 3-5 | one layer per step, bottom first |
| `example` | `tag` (e.g. "Real-world example"), `icon`, `h` (6), `p` (45), `points` [(16)] x 0-3, optional `src` (12) | main text, then one point per step |
| `stats` | `title` (9), `items`: [{`v` (e.g. "15-25%", max 8 chars), `l` (18)}] x 2-4, optional `note` (30) | one stat per step |
| `table` | `title` (9), `head` [..] (max 4 cols), `rows` [[..]] max 6 rows, cells max 8 words | one row per step |
| `formula` | `title` (9), `items`: [{`h` (4), `f` formula text (max 60 chars, use × ÷ √ ²), `p` (20)}] x 1-3 | one formula per step |
| `calc` | `title` (9), `given` [(12)] x 1-3, `steps` [(16)] x 2-4, `result` (12) | given, then one step per step, then result |
| `reflect` | `q` (30), optional `q2` (30) | 1 frame |
| `recap` | `title` (9), `items` [(16)] x 4-6 | one item per step |
| `closing` | `title` (8), optional `sub` (20) | 1 frame. Next steps (quiz, certificate, original article) are added automatically |

Optional on content scenes: `kicker` (3 words, small blue label above the title).

### Icons
Use only names listed in `courses/_studio/icons.txt` (Lucide icon names, e.g. `heart-pulse`, `ruler`, `factory`).

## Quiz (8-10 questions, pass mark 70 %)

```json
{ "type": "mc", "q": "max 30 words", "options": ["4 options, max 14 words each"], "answer": 1, "feedback": "max 30 words, explains the right answer" }
{ "type": "tf", "q": "statement, max 30 words", "answer": true, "feedback": "..." }
{ "type": "ma", "q": "... (select all that apply)", "options": ["4-5 options"], "answers": [0, 2], "feedback": "..." }
```
Mix: mostly `mc`, 1-2 `tf`, at most 1 `ma`. Test understanding, not trivia; wrong options must be plausible
but clearly wrong according to the course. Spread the correct answer positions.
