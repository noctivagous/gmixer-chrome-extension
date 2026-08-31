
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
 
 
 