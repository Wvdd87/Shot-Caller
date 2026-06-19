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

#6A Text selection and dragging is not smooth. I can't seem to select certain parts of the text. Especially when changing the selected text for a cue. The user needs a flawless smooth text selection experience. Also when changing the text for a certain cue

#6B Text should only be able to belong to 1 cue. never multiple.

#7 rich text edits must show up in the cue list on the right and also in the live view

#8 Make it possible to batch select cue's and chapters to delete them in the cue list

#9 clicking on a cue should show it's position in the cue mode text and highlight it. Opening the cue detailed side panel on the right should be done with a edit button that appears when hovering over a cue in the cue list.

#10 design all modals in the app so they are not the browser native modals. eg the delete cue modal. Follow UI kit rules