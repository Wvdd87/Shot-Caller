✅ #1 making edits in cue mode, then going to text mode and back to cue mode creates weird errors. when going back and forth. this should be a streamlines experience. the user should not see any difference in the text. As far as he knows he only changes the functions (rich text edit or cue select), not actually changing the view or how it is seeing the text. It should all happen on the same visual reference for the user.
   DONE — Cue Mode and Text Mode now render ONE shared DOM element; switching only toggles contentEditable + the cue overlay. Verified: identical text & HTML across modes, no reflow.

✅ #2 the assign shot modal is sometimes too low. it gets cut off by the browser window. Give it a position where it's always visible.
   DONE — the popover now measures itself and clamps/flips above the cursor so it's always fully on screen. Verified with a selection at the very bottom of a 60-line script.

✅ #3 marking text as chapter, should take the selected text as the chapter name automatically. it should not use the selected text for a cue and connect a camera at the same time. a selectino is either a cue connected to a camera or it is a heading. not both.
   DONE — the popover now has a Camera Shot / Chapter tab switch. Chapter mode hides the camera/shot fields, auto-fills the chapter name from the selected text, and creates ONLY a heading (no shot, no camera).


✅ #4 In the shot modal, when using vocabulary buttons it should always add a space after the inserted word
   DONE — vocabulary chips (and the `/` autocomplete) now insert the term followed by a trailing space, caret placed after it.


✅ #5 the cursor when selecting text in cue mode should be a I-beam. Chpter's should be highlighted as grey in the cue mode.
   DONE — Cue Mode now uses an I-beam (text) cursor. Chapters carry their selected text range and render as a grey heading highlight (with a ▶ label) right in the cue-mode script. Verified: cursor computes to `text`, grey highlight rgba(124,126,138,0.22) drawn, full suite 36/36 green.

✅ #6A Text selection and dragging is not smooth. I can't seem to select certain parts of the text. Especially when changing the selected text for a cue. The user needs a flawless smooth text selection experience. Also when changing the text for a certain cue
   DONE — Cue Mode now uses the browser's NATIVE text selection (read on mouse-up) instead of custom mouse tracking, so selection is buttery smooth (word wrap, shift-click, double-click word all work). Cue highlights are click-through (pointer-events:none) so they never block selecting any part of the text — including the gaps right next to existing cues.
   ROOT-CAUSE FIX (reported still-broken): the DOM→character index mapping in textmodel.ts drifted by the number of collapsed spaces before the cursor, so a phrase deep in a long line came back shifted/truncated ("Edward Bloom. The crowd parts to" → "other than Edward Bloom. Th"), and cue ranges looked like whole blocks. Now each emitted character stores its TRUE global plainText index (spaces included) and element/padding hits fall back to a document-order binary search — so selection + resize are character-exact and no longer jumpy.
   Handles now appear on HOVER (no need to select first) with a short grace period + handle keep-alive so they don't flicker on multi-line cues, and dragging a handle never selects the cue in the cue list. My earlier tests missed this because they selected near the start of short lines and only checked `.includes()`; the suite now drag-selects an exact phrase deep in a long wrapped line and asserts the selected text + stored slice match character-for-character.
✅ #6B Text should only be able to belong to 1 cue. never multiple.
   DONE — overlapping selections are rejected on create (clear inline message naming the conflicting cue), and handle-resize is clamped to the neighbouring cues in the reducer so a boundary can touch but never cross into another cue. Verified: A.end == B.start, no character ever in two cues. Suite 42/42 + dedicated clamp/gap/double-click test 7/7, 0 JS errors.

✅ #7 rich text edits must show up in the cue list on the right and also in the live view
   DONE — the cue list, live view, shot detail panel and jump preview now render each cue's script with its bold/italic/underline intact (previously they showed stripped plain text). A new makeRichSlicer (textmodel.ts) reuses the same character-walk as the cue indices, builds a Range for the cue's [start,end), clones the formatted contents and serializes to safe inline HTML (only b/i/u tags, no attributes — script/img/handlers are reduced to escaped text, so it doubles as a sanitizer). Verified: bolding a word in Text Mode shows in shotlist + live, plainText indices stay correct, formatting survives reload, no script tags leak. Suite 46/46, 0 JS errors.

#8 Make it possible to batch select cue's and chapters to delete them in the cue list

#9 clicking on a cue should show it's position in the cue mode text and highlight it. Opening the cue detailed side panel on the right should be done with a edit button that appears when hovering over a cue in the cue list.

--------

#10 design all modals in the app so they are not the browser native modals. eg the delete cue modal. Follow UI kit rules

