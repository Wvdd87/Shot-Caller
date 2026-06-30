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

✅ #8 Make it possible to batch select cue's and chapters to delete them in the cue list
   DONE — each cue + chapter row now has a checkbox (hidden until you hover a row or a selection is active). Click to toggle, Shift+click for a range, and a header checkbox for select-all/indeterminate. When ≥1 is selected an amber batch bar shows "N SELECTED · Clear · Delete N"; Delete (or the Delete/Backspace key) opens a UI-kit confirm modal and removes all selected cues AND chapters in one atomic reducer action (DELETE_ITEMS), renumbering once. Selected rows get an amber tint + left border. Verified: shift-range, mixed cue+chapter delete, renumber, key shortcut — suite 51/51, 0 JS errors.

--------

✅ #9 clicking on a cue in the cue list should show it's position in the cue mode text and highlight it (like it is now) but it should not open the cue detail side panel. Opening the cue detail side panel on the right should be done with a edit button for each cue that appears when hovering over a cue in the cue list.
   DONE — row click selects only (highlights cue in script, amber left border on row). Pencil edit button appears on row hover; clicking it selects + opens the detail panel. Bidirectional: clicking in the script selects and auto-scrolls the list row into view; selecting a row smooth-scrolls the script to show that cue's text. Suite 51/51, 0 JS errors.

--------

✅ #10 design all modals in the app so they are not the browser native modals. eg the delete cue modal. Follow UI kit rules
   DONE — all four native-modal sites replaced: ShotDetailPanel delete-shot confirm(), ScenesPanel delete-scene confirm(), ErrorBoundary reset-data confirm(), Shotlist go-to-cue prompt(). Each now uses ConfirmModal (UI-kit) or a custom inline input modal (go-to-cue). Suite 51/51, 0 JS errors.

--------

✅ #11 When making a new project cue mode is shown with a help text "Use Import → Import Script to bring in a script, then select text to assign shots." This should be replaced with a 'import script' button.
   DONE — the empty state in ScriptViewer now shows "NO SCRIPT YET / Import a script to get started." + an amber "Import Script" button that directly opens the ImportScriptModal. Suite 51/51.

--------

✅ #12 The settings button should be at the bottom of the rail side panel. The settings should open a modal instead of the current collapsable panel. It should consist of the "vocab" and "Camera" bus menu's.
   The Display settings should only be accesible from the live screen from a "display" button in the header
   The "Live script column width" currently does't allow a numerical input. I should be able to put in a specific number.
   DONE — Settings gear icon removed from the main panel list and pinned to the bottom of the rail (margin-top: auto). Clicking it opens a "PRODUCTION — SETTINGS" modal with CAMERAS + VOCAB tabs only. Live mode now has a "Display" button in the bar-right that opens DisplaySettingsModal (running time toggle + cue table width). Column-width input is now a plain text field with numeric validation on blur, so you can type any px value freely. Suite 51/51, 0 JS errors.

----------

✅ #13 The item in the next actions should show the next shot for the camera of the previous cue. it answers "What should the previous camera do to get ready for his next shot?"
   DONE — CREATE_SHOT now derives prepNote from the PREVIOUS shot's camera label (not the new shot's camera). E.g. if shot 001 is CAM 1 doing WS, then shot 002 on CAM 2 doing MCU HAMLET gets "CAM 1 → MCU HAMLET" — telling CAM 1 to prepare their next assignment. First shot falls back to the current camera. UPDATE_SHOT no longer auto-overwrites prepNote when shotType changes; instead it sets prepNoteStale=true, showing an amber "Prep note may be outdated" badge in the detail panel with an "Auto generate" button that regenerates from the correct previous camera. Suite 51/51, 0 JS errors.

-----------

✅ #14 For the live view: 
   DONE — (1) Column widths are draggable: hover a header divider to get the col-resize cursor, drag to resize; widths stored in local state, zero-flicker via CSS custom props on the table ref. Defaults: NEXT ACTION 200px, CAM/SHOT 180px, SCRIPT TEXT fills remaining. (2) Pause/play button removed from the live bar (P keyboard shortcut still works). (3) Camera number replaced with a colored cam-badge in the CAM/SHOT column. (4) "Cue table width" setting (Display modal) now controls the total table width centered in the viewport (default 900px, used to be 480px for script col only). (5) Live cams sidebar widened to 180px; shot text uses word-wrap instead of overflow-hidden/ellipsis. Suite 51/51, 0 JS errors.

-----------

#15 For the edit view:

- clicking outside the opened side bar should close it.
- the "hdr-save" is not readable. It's contract is too low.
- the import side panel should not show a project import function. this exist in the project side panel.
- The export side panel should not show a project export function. this exist in the project side panel. 

There should be 2 export options:

Export Type 1: Camera Script
Exports the full 4-column shotlist for the entire show.
Columns (in order):

Shot Number
Next Action (the prep note / column 2 content)
Camera + Shot Name (camera label followed by shot type text, in the same cell)
Script Text

Format options:
CSV:

Filename: [ProjectTitle]_CameraScript.csv
Header row: Shot #,Next Action,Camera & Shot,Script Text
One row per shot
Text fields wrapped in double quotes
Line breaks within script text replaced with a space in CSV output

PDF:

Filename: [ProjectTitle]_CameraScript.pdf
Generated directly as a downloadable PDF — does not open the browser print dialog
A4 portrait
Header at top of each page: project title (left), page number (right)
4-column table, full width
Column widths proportional: Shot# narrow, Next Action medium, Camera+Shot medium, Script Text widest
Body font: a clean readable sans-serif, minimum 9pt
Alternating row shading (very light grey on white) for readability
Downloaded immediately on click — no preview step

Browser Window:

Opens a new browser tab with a formatted HTML page
Same 4-column layout as the PDF
Styled for print: white background, black text, print-ready CSS (@media print rules included)
A "Print this page" button appears at the top of the page (hidden in print view)
The page title is set to the project name

Export Type 2: Camera Sheets — Clarifications
Camera selection step: The export modal shows a list of all cameras with checkboxes before generating. All cameras are checked by default. The user can uncheck individual cameras to exclude them. A "Select All / Deselect All" toggle is provided.
PDF — one separate PDF file per selected camera:

Each camera generates its own independent PDF file
If multiple cameras are selected, all PDF files are bundled into a single .zip archive and downloaded as one file
Archive filename: [ProjectTitle]_CameraSheets.zip
Individual PDF filenames inside the archive: [ProjectTitle]_CAM[n]_Sheet.pdf
If only one camera is selected, a single PDF is downloaded directly without a zip wrapper
Each PDF is A4 portrait
Each PDF contains one page per camera (or more pages if that camera's shot list overflows a single page)
Layout per page: project name and camera label as a header, followed by a multi-column snake layout as described in the previous change set
Generated and downloaded directly — does not open the browser print dialog

CSV — same zip behavior:

If multiple cameras selected, all CSVs are bundled into a .zip archive
If only one camera selected, a single CSV downloads directly

Browser Window:

Implement the same way the existing browser window export works in the current app — same mechanism, same behavior, applied to this new layout and content

--------------------

#16 I should be able to also change a chapter's text selection in the cue mode with a start and end drag handle.

---------------

#17 the Import script button in the empty cue mode does not work. it should open the imoprt script modal

------------

#18 the text in the next action column  is not correct. it should be: [camera number of previous row] → [next shot for the camera number of previous row]

---------------

#19 For the display settings modal:
- the background of show running time text and toggle is white, messing up the whole UI styling.
- There should be a font size setting. This setting controls the font size of the text in the table in live mode

Change this from a modal into a dropdown settings menu with sliders for: 
-> font size (from 10px to 30px) Default should be 16 px
-> table width (from 300 px to window width) Default should stay 900 px

----------------

#20
Get rid of the mode switch modal. show keybaord hints in the live mode "Use Space / ↓ to advance, ↑ to go back, J to jump, P to pause."

the current indication "SPACE · ↑↓ · J · P" is not readable because of low contrast

-------------------

#21
For live view: 
- the current cue should always be at the top of the window. even when there are no more cue's left at the bottom to push up the latest cue's.
- the current chapter name should show next to the lb-counter
- the camera badge should be square. around 40x40px with font size 26px. the badge should show above the shot name

-------------------

#22
Keep the layout but do a full redesign by applying the design of the ui kit from ui-kit/CueFlow UI Kit v2.html

---------------------




