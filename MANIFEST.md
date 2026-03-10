# Escape Room Platform - Educational Manifest

## Core Mission & Pedagogy
This modular escape room platform is built to deliver interactive puzzles that teach Computer Science concepts following the Czech RVP (Revize 2021/2026) for Informatika.
Puzzles are designed to be strictly environmental and interactive avoiding multiple-choice testing.

## 8-Level Difficulty Matrix

| Level | Grade Target | RVP Topic | Puzzle Example / Concept |
| :---: | :--- | :--- | :--- |
| **1** | Elementary (6-7) | **Algorithmic Thinking** | **"Robot Instruction"** – Move a character using block-like commands (e.g., sorting boxes to open a door). Introduces sequences. |
| **2** | Elementary (6-7) | **Algorithmic Thinking** | **"The Repetitive Lock"** – Implementing basic loops (Repeat N times) to bypass a rhythmic security measure. |
| **3** | Elementary (8-9) | **Data Representation** | **"Binary Torch"** – Toggle lights (0/1) to match a pattern on the wall. Introduces bits and bytes. |
| **4** | Elementary (8-9) | **Data Structures** | **"The Archives"** – Organizing physical objects into arrays or simple trees to retrieve a hidden key. |
| **5** | High School (1-2) | **Logic & Circuits** | **"Wire the Gate"** – Use AND/OR/NOT gates to correctly distribute power to an electronic lock mechanism. |
| **6** | High School (1-2) | **Cybersecurity (Intro)** | **"Phishing the Guard"** – Identifying a safe digital message to bypass social engineering filters at a terminal. |
| **7** | High School (3-4) | **Computational Complexity**| **"The Brute Force Generator"** – Optimizing a system's processing path to crack a weak PIN before a timer runs out, demonstrating O(N) vs O(1). |
| **8** | High School (3-4) | **Security & Scripting** | **"SQL Infiltration"** – Use a terminal interface to craft queries to find a specific password hidden in a data table to unlock the final exit. |

## Campaign Authoring Checklist

1. Add the campaign metadata and `timeLimitMinutes` to `frontend/src/features/puzzles/registry.json`.
2. Define each level with a unique `id` and `componentPath`. Interstitial room or desktop screens count as levels and should be authored the same way.
3. Start new puzzle screens from `frontend/src/features/puzzles/_TEMPLATE/index.tsx` so every module uses the shared `PuzzleComponentProps` contract.
4. Keep room interactions, inventory, notes, timer state, and resume behavior inside the shared campaign session model instead of component-local storage.
5. Register the backend validation rule in `backend/puzzles/validation_schema.json` using one of the supported validation `type` handlers, or add a new generic handler when introducing a new puzzle category.
6. Prefer extending the typed registry and schema-driven validation flow over hardcoding campaign or level IDs in component code.

## Scaling Notes

- The frontend now treats campaigns as registry-driven modules with a shared session model, which is the minimum baseline for supporting 8 campaigns with 6+ levels each.
- The backend validator is schema-driven. Adding a new level should generally mean adding schema and a frontend screen, not editing a central hardcoded lookup table for every single level.
- Interstitial screens are first-class levels. They should publish `PUZZLE_SOLVED` or `PUZZLE_CLOSED` through the typed event bus just like interactive puzzles.
