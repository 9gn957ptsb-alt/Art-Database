# Colour and space: Cézanne, Van Gogh, Monet

A study of how three painters of the open air (*plein air*) build landscape space out of colour, made from the works
Aries has saved (data/artworks.db: 78 Cézanne, 66 Van Gogh, 63 Monet). Everything here is meant to become the basis of
how DRIFT depicts space. The images stay private (dirt/private/colour/); only the findings are here.

## What was measured

Forty-eight works, in four groups: eight Cézanne watercolours (*Chemin des Lauves*, *Le Sentier*, *Sous-bois*,
*Trees Leaning over Rocks*, *Mont Sainte-Victoire* [recto], *Arbre dépouillé au Jas de Bouffan*, *Three Pears*, *Still
Life with Carafe, Bottle, and Fruit*), and ten landscapes each in oil by Cézanne, Monet and Van Gogh. Each image was
reduced to about 300 pixels, cropped of its frame, and read in CIELAB (L* light, a* green–red, b* blue–yellow, C*
chroma).

| | value span (L*, 20th–80th percentile) | mean chroma | shadows' chroma | lights' chroma | lights warmer than shadows (b*) | colour at edges ÷ inside forms | hue change ÷ value change |
|---|---|---|---|---|---|---|---|
| Cézanne, watercolour | **13** | 13 | 11 | 13 | +5 | **×2.6** | 0.8 |
| Cézanne, oil | 26 | 17 | 14 | 14 | +3 | ×1.0 | 1.1 |
| Monet | 27 | 13 | **15** | 11 | +0 | ×1.4 | **1.3** |
| Van Gogh | 30 | **21** | 18 | 20 | **+9** | ×1.0 | 1.0 |

("Shadows" and "lights" are each picture's darkest and lightest fifth. "Colour at edges" compares how far colour
departs from the picture's ground where colour or value changes fastest against everywhere else.)

## Findings

1. **A shadow is a colour, not a darkening.** In all four groups the darkest fifth is about as saturated as the
   lightest; in Monet it is *more* saturated (15 against 11). None of them greys a shadow toward black, which is what
   the academic chiaroscuro they left behind did. Shadows go blue, violet and green instead: Monet's haystack shadows
   are violet and blue on a yellow-green field, Cézanne's are ultramarine and viridian strokes.
2. **Cézanne's watercolours make space with almost no value.** Their whole middle range spans 13 L* (the oils, 26; Van
   Gogh, 30): the depth is carried by hue and temperature, by warm ochres and oranges against blues and violets, and by
   untouched paper.
3. **Colour gathers where a form turns away.** In the watercolours colour stands 2.6 times farther from the paper at
   the edges of forms than inside them. The part of a form nearest the eye (the bulge of a pear, the face of a house in
   *Chemin des Lauves*) is left as paper or a pale yellow; blue, green and violet pile up at the contours, often laid
   down three or four times, slightly apart. Cézanne said as much: "in an orange, an apple, a ball, a head, there is a
   culminating point; and this point is always … the closest to our eye; the edges of the objects recede toward a
   centre on our horizon" (letter to Émile Bernard, 25 July 1904; in translation). So the dark does not sit on the most convex part of a
   form; it sits where the convex form turns away, and the culmination stays light.
4. **Warm advances, blue recedes and makes air.** "Nature, for us men, is more depth than surface, whence the need to
   introduce into our light vibrations, represented by reds and yellows, a sufficient amount of blue to give the
   impression of air" (Cézanne to Bernard, 15 April 1904; in translation). In the oils the far hills of *Mont Sainte-Victoire* are
   blue-violet and the near fields ochre and green, and *Le Jardin des Lauves* goes from yellow-green (near) through a band of
   dark blue to patches of violet and blue (far and sky).
5. **Van Gogh splits temperature hardest.** His lights are 9 b* yellower than his shadows, the strongest split of the
   four, at the highest chroma (21): wheat in chrome yellow against cypresses in blue-black green, the red vines of
   *The Red Vineyard* against the workers' blue-green. He chose complements to carry feeling as well as form ("to express the terrible passions of
   humanity by means of red and green," of *The Night Café*, letter to Theo, 8 September 1888).
6. **Monet paints the effect; Cézanne paints the object.** Monet's changes of hue outrun his changes of value (1.3 to
   1), and his lights and shadows share one temperature: a whole picture is tuned to one condition of light, the
   *effet* his titles name (*Wheatstacks, Snow Effect, Morning*; *Haystacks, Midday*). Cézanne's colour stays tied to
   the form and its place, whatever the hour. This is the distinction Aries draws: Cézanne uses colour to define objects
   in space, not to record a light, and what it arrives at is the *locality* of a place, its own phenomena and texture
   as the painter gauges them.
7. **Modulate, not model.** Cézanne is reported to have said one should not say *model* but *modulate* (Émile Bernard's
   recollections): turn a form by stepping its hue through a sequence of small patches of neighbouring colour, not by
   shading it from light to dark.

What cuts against this: Monet's series show that a single light, followed exactly, also builds convincing space, and
the theory the Impressionists drew on, Chevreul's law of simultaneous contrast (*De la loi du contraste simultané des
couleurs*, 1839), is about how neighbouring colours alter each other in the eye, not about form. The three agree on
coloured shadows and diverge on what colour is for.

## Rules for DRIFT

- Never shade toward grey or black: a shadow keeps its chroma and turns cool (blue, violet, green).
- Build depth by temperature first and value second: warm and saturated near, blue-violet and paler far; keep the
  value range narrow (about 13 to 26 L* across the middle of the view).
- Put colour where forms turn away, not on their fronts: fronts stay near the ground (the paper), edges collect
  repeated, slightly offset contours of blue and green.
- Modulate: turn a surface in steps of neighbouring hues, as patches, not a smooth gradient in value.
- Colour belongs to the place, not the hour: each locality keeps its own local phenomena and textures; light may play
  over it, but does not decide it.
