# Library

## Purpose

The library is the user's personal quiz and crossword management system. It organizes all items in a familiar file-explorer metaphor.

## Structure

- **Root** — top-level view showing all folders and ungrouped quizzes/crosswords.
- **Folders** — user-created containers for organizing items (e.g. "Biology", "Physics", "Exam Prep").
- **Quizzes** — individual quiz items within folders (shown with a `FileText` icon).
- **Crosswords** — individual crossword items within folders (shown with an amber `Grid3x3` icon).

An item belongs to exactly one folder or to the root (uncategorized). Crosswords and quizzes are listed alongside each other in the tree and support the same management operations.

## Operations

| Action | Description |
|---|---|
| Create folder | Name a new folder at the current level. |
| Rename folder | Edit folder name. |
| Delete folder | Remove folder and all items inside (with confirmation). |
| Move item | Drag-and-drop or batch-select to move to another folder. |
| Rename item | Edit item name via inline input (hover icon or double-click). |
| Delete item | Soft-delete to trash (with confirmation). |
| Select mode | Toggle select mode for batch operations (delete, move). |
| Batch delete | Delete multiple selected items at once. |
| Batch move | Move multiple selected items to a folder. |
| Trash | View and restore/permanently-delete soft-deleted items. |

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
