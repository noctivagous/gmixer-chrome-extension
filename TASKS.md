
[ ] there is often a flash from the page's original appearance to our result, even after  our page analyzer has
visited one of the pages.  First, is our page analyzer caching its analysis well for each new page load 
of the same website? should we use css:filter on elements across 
the entire page so that before analysis the entire page has no white spots that are part of the original page, such as 
transitioning to a dark theme?  



[ ]  1. Light, Gray, Dark list on "Tone" of gmixer settings should have a slim arrow on the right edge pointing to the right.
  1a.  Add a Dark Gray Tone after and a Light Gray Tone before it in this section. They sit in between
  Order: Light, Light Gray, Gray, Dark Gray, Dark.  
  2a. Add an intensity slider for the given Tone that fits inside its tone range.  So in Light, the 0 setting will be as
  light as possible, a white bg and the 1.0 setting will be the upper bound of the tone.  For Dark, 0.0 will be 
  very dark gray and 1.0 will be black.
  2a i. Whatever the gray is in the absolute scale of 0 to 1, with 0 being black, should seed the next
  tab, Color Scheme, in the walkthrough popover
  
  2b. We want a feature of our page analyzer that recognizes that often what we classify as BG:Secondary is
  serving as what we regard as BG:Primary so we can give these surfaces BG:Primary.  We should consider
  that in the case we bump down a BG:Secondary to BG:Primary we may have to adjust other assignments.
  2c. We want to make sure that we have a distinction between Surface:Containers and BG:Secondary
  but right now they have the same color.
  2d. We want Surface:GUI:Button and Surface:GUI:TextArea, Surface:GUI:Input[text], Surface:GUI:Input[slider]
We may have added these already and if so reconcile them with the names just given,
using whichever fits best.  We don't seem to show all of them in 
BG:Secondary:Button
BG:Secondary:InputField
BG:Secondary:TextArea
Accent:Heading-Large  // h1-h2
Accent:Heading-Medium // h3-h4
Accent:Heading-Small // h5-h6
Link:Bare // for links outside of articles
Link:Article // for links inside articles
Link:Heading // for links inside heading tags, should inherit the same as the heading.
Muted:Caption-Kicker
Muted:Photo-Caption (probably for <caption>)
Muted:Caption-Asides-Notes
  2e. Make a dedicated preview page in the extension that is
  primarily for debugging that lists all of the surfaces
  classified and .
  
  3. We need examples of h3-h6 in the Live Preview and put them in the bottom section
  so that there aren't too many h tags together.
  
  4. Add drop shadows (dark instead of lighter) and drop glows (current) to the Effects
  tab.  Add some marquee outline effects as well where there is one or more elements
  moving around the perimeter of the container.
  4a. internal image effects, pan and scan and rotate cube should be in a separate
  dropdown from glow, drop shadow, etc.
  
  5. after the user clicks "done" in the last tab, there is a brief flash of the background
  of the walkthrough popover before the dialog box comes up that tells the user
  about how to return to settings
  


[ ] web transitions api accordion item section
