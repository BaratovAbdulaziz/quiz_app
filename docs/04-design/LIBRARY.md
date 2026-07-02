# Library

## Purpose

The library is the user's personal quiz management system. It organizes all quizzes in a familiar file-explorer metaphor.

## Structure

- **Root** — top-level view showing all folders and ungrouped quizzes.
- **Folders** — user-created containers for organizing quizzes (e.g. "Biology", "Physics", "Exam Prep").
- **Quizzes** — individual quiz items within folders.

A quiz belongs to exactly one folder or to the root (uncategorized).

## Operations

| Action | Description |
|---|---|
| Create folder | Name a new folder at the current level. |
| Rename folder | Edit folder name. |
| Delete folder | Remove folder and all quizzes inside (with confirmation). |
| Move quiz | Move to another folder. |
| Rename quiz | Edit quiz name. |
| Delete quiz | Remove quiz permanently (with confirmation). |
| Duplicate quiz | Create a copy of a quiz (future). |

## Default Upload Location

- Quizzes uploaded or generated are placed in the root folder by default.
- The user can move them into a folder later.

## View

- List view only (tree-style expandable).
- No card view.
- The tree shows folders as expandable nodes and quizzes as leaf items.

## Sorting and Filtering

- Sort by: name (A-Z), created date, last practiced, question count.
- Filter by: source (uploaded PDF, AI generated), folder.

## Search

- Full-text search across quiz titles and question content.
- Results show matching quizzes with context snippets.

## UI Behavior

- Default view shows folders and quizzes in a single tree list.
- Empty folders are hidden from the tree (but still exist).
- Long quiz names are truncated with ellipsis.
