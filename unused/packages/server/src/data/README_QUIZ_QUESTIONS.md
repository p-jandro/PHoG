# Quiz Questions - How to Fill In

## Overview
The quiz game now has **15 rounds**, each with **4 question options** that players vote on.
This means you need to create **60 total questions** (15 rounds × 4 options).

## Current Status
- ✅ **Round 1**: Complete (4 sample questions)
- ⚠️ **Rounds 2-15**: PLACEHOLDER questions that need to be replaced

## Question Format

Each question in `quizRounds.json` follows this structure:

```json
{
  "id": "r1_option1",
  "category": "History",
  "difficulty": "easy",
  "color": "#00D4AA",
  "question": "When did World War II end?",
  "answers": {
    "A": "1943",
    "B": "1945",
    "C": "1947",
    "D": "1950"
  },
  "correct": "B"
}
```

## Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique identifier | `"r2_option1"` |
| `category` | string | Question category | `"History"`, `"Geography"`, `"Gaming"`, etc. |
| `difficulty` | string | Difficulty level | `"easy"`, `"medium"`, `"hard"`, `"impossible"` |
| `color` | string | HEX color code | See color table below |
| `question` | string | The actual question | `"What is the capital of France?"` |
| `answers` | object | 4 possible answers | `{"A": "...", "B": "...", "C": "...", "D": "..."}` |
| `correct` | string | Correct answer key | `"A"`, `"B"`, `"C"`, or `"D"` |

## Color Codes by Difficulty

| Difficulty | Color Code | Visual |
|------------|-----------|--------|
| easy | `#00D4AA` | 🟢 Teal/Green |
| medium | `#0066FF` | 🔵 Blue |
| hard | `#FFA502` | 🟠 Orange |
| impossible | `#FF4757` | 🔴 Red |

## Suggested Category Mix

You can use any categories you like, but here's a suggested mix for variety:

- **History** (ancient, modern, world events)
- **Geography** (capitals, landmarks, countries)
- **Gaming** (video games, esports, gaming culture)
- **Flags** (country flags, symbols)
- **Science** (biology, chemistry, physics, space)
- **Sports** (athletes, records, rules)
- **Music** (artists, songs, instruments)
- **Movies** (actors, plots, directors, trivia)

## Tips for Creating Good Questions

1. **Vary Difficulty**: Each round should have one question of each difficulty
   - Easy: Common knowledge
   - Medium: Requires some knowledge
   - Hard: Challenging but fair
   - Impossible: Very difficult, obscure knowledge

2. **Make Wrong Answers Plausible**: Don't make it too obvious which is correct

3. **Be Specific**: Avoid vague or ambiguous questions

4. **Test for Clarity**: Make sure the question can be understood in 15 seconds

5. **Mix Categories**: Don't put all history questions in rounds 1-5, spread them out

## Example Round Structure

Here's an example of a well-balanced round:

```json
{
  "roundNumber": 2,
  "options": [
    {
      "id": "r2_history_easy",
      "category": "History",
      "difficulty": "easy",
      "color": "#00D4AA",
      "question": "Who was the first President of the United States?",
      "answers": {
        "A": "Thomas Jefferson",
        "B": "George Washington",
        "C": "John Adams",
        "D": "Benjamin Franklin"
      },
      "correct": "B"
    },
    {
      "id": "r2_geography_medium",
      "category": "Geography",
      "difficulty": "medium",
      "color": "#0066FF",
      "question": "Which river is the longest in the world?",
      "answers": {
        "A": "Amazon River",
        "B": "Nile River",
        "C": "Yangtze River",
        "D": "Mississippi River"
      },
      "correct": "B"
    },
    {
      "id": "r2_gaming_hard",
      "category": "Gaming",
      "difficulty": "hard",
      "color": "#FFA502",
      "question": "What year was the Nintendo Entertainment System (NES) released in North America?",
      "answers": {
        "A": "1983",
        "B": "1985",
        "C": "1987",
        "D": "1990"
      },
      "correct": "B"
    },
    {
      "id": "r2_flags_impossible",
      "category": "Flags",
      "difficulty": "impossible",
      "color": "#FF4757",
      "question": "Which country's flag features the only firearm?",
      "answers": {
        "A": "Guatemala",
        "B": "Mozambique",
        "C": "Haiti",
        "D": "Angola"
      },
      "correct": "B"
    }
  ]
}
```

## Workflow for Filling In Questions

1. Open `packages/server/src/data/quizRounds.json`
2. Find a round with PLACEHOLDER questions (rounds 2-15)
3. For each of the 4 options in that round:
   - Choose a category
   - Choose a difficulty (one of each per round)
   - Set the appropriate color code
   - Write a clear, specific question
   - Create 4 answer options (A, B, C, D)
   - Mark which one is correct
4. Update the `id` field to be descriptive (e.g., `r2_science_easy`)
5. Repeat for all 15 rounds

## Question Generation Ideas

You can:
- Use AI to generate questions (ChatGPT, Claude, etc.)
- Pull from trivia websites
- Create your own based on interesting facts
- Mix serious and fun questions

## Validation Checklist

Before you're done, make sure:
- [ ] All 15 rounds have 4 unique questions
- [ ] Each round has one Easy, one Medium, one Hard, one Impossible
- [ ] All color codes match the difficulty levels
- [ ] Each question has exactly 4 answers (A, B, C, D)
- [ ] Each question has a correct answer specified
- [ ] All question IDs are unique
- [ ] Questions are interesting and varied
- [ ] No typos or grammatical errors

## File Location

The file to edit is:
```
packages/server/src/data/quizRounds.json
```

## Need Help?

If you need help generating questions, you can:
1. Ask an AI assistant to generate questions in this format
2. Use trivia databases online
3. Create a batch template and fill it in systematically

Good luck, and have fun creating your quiz!







