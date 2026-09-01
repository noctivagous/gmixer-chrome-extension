
RELEASE GOALS 

0.1.0 - Graphic design completeness.
Pages are restyled but don't have
lots of customizability for animations
and backgrounds.  Extension stores
setting for each site in cache
for document_start script so that
restyling is faster.

deferred sections: Texture, Clipping/Corners.

0.1.1 - Texturing of page, Clipping/Corners,
Minimum/maximum values for font size in
Typography groups.

[ ] In Typography, we want a feature that is enabled
manually by the user for each styling category like h1,
body text, beneath the font picker select dropdown.
Put a checkbox to the left of a range slider 
for font size and default state is unchecked. 
The range slider has two knobs on either end for min/max.
By default the h1 slider might have a minimum font-size value of
15pt and a maximum of 50pt. Each range slider can have
a min value of 6pt and a max of 70pt and these values
should be in a config file too.  If the feature is
disabled, these settings don't apply.  If it is disabled,
they are saved and restored when enabled again.
i.e. if the user drags the min knob for h1 and on
the page the min is higher than the h1 elements' heights
on the page it will increase the font size of h1 
elements on the page.

[ ] 

Events and Actions

- each Event section allows multiple actions 
to be placed in sequence.

  Action:AnimateElement comes from the http://animate.style css 
  library.  Make sure that animation elements are only
  available for the actions where they make sense.
  backInLeft won't make sense for hovering over a link.
  

 - Event:Hover:Link
    Action:AnimateElement:shakeX
 
 - Event:Hover:Image
    Action:AnimateElement:flip

 - Event:Hover:Video
     Action:AnimateElement:bounceIn
     
// navigation to a link wrapping an image
 - Event:Navigation:Link[Image]
    Action:AnimateElement:flip
    
// navigation to a link wrapping an video
 - Event:Navigation:Link:Video
  
 - Event:Hover:[Custom DOM Query]
 
 - Event:Click:Button
 
 - Event:PageFinishedLoading
 
 
 
[ ] 10. Add a View Transitions API animation to the accordion item open/close in the in-page Settings shell (`gmixer-settings.js:1039`, `.accordion` CSS at `gmixer-settings.js:464`, toggled via `_toggleExpanded()` at `gmixer-settings.js:1125-1128`). No View Transitions usage exists in the codebase today — this is a net-new addition, using `document.startViewTransition` (with a feature check / fallback for browsers without support) to animate the expand/collapse instead of the current instant mount/unmount (the ternary at lines 1088-1095 has no transition at all; `.section-panel`'s existing CSS transitions at lines 507-519 only cover `border-color`/`box-shadow`/`background`/`opacity`, not the content swap).
  Note: `extension/settings-frame.js` and `extension/walkthrough-frame.js` are generated build output (via `node build.js` from `src/`), not separate sources — edit `src/settings/components/gmixer-settings.js` and rebuild, don't edit the `extension/` copies directly.
  Unrelated secondary collapsible worth knowing about but out of scope here: native `<details>/<summary>` in `src/popup/components/image-filter-panel.js:225-287` ("Detailed Media Categories").
