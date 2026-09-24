# DIRT Earth: the grammar of places

Written by `dirt/earth/grammar.py --markdown`, from the same data DIRT Earth grows its places from. For every biome: the
strata of its plants and the shape of their crowns from above, its ground, how it turns through the year, the looks it
wears, and its life by the height it lives at, each kind a behaviour DIRT animates with species realm by realm. Heights
are shares of the tallest emergent (34 cells); spacing and reach are in DIRT's cells.

## Crowns seen from above

| shape | what it is |
|---|---|
| lobed | a broadleaf crown: a low dome swelling in five lobes and eight smaller ones |
| cone | a conifer seen from above: a steep point, bright on the sunward side, its skirts in shadow, star-edged with eight branches |
| umbrella | a flat-topped crown, broad and thin, crisp-edged, standing high on a bare trunk, so its shadow lies far from it: an acacia |
| palm | fronds radiating from a point: eight deep lobes |
| column | a column with almost no crown: a cactus or a quiver tree, all shadow |
| tussock | a clump of grass: a tiny, tight mound, many together |
| cushion | a cushion plant or dwarf shrub: a low, dense, rounded mat |
| rosette | a giant rosette on a stem: a star of thirteen leaves, as frailejones and giant lobelias |
| reed | reeds and papyrus in water: fine, dense, leaning with the wind |
| mangrove | a low, dense crown standing in water on its roots |

## Grounds

| ground | what it is |
|---|---|
| litter | the forest floor: leaf litter over dark soil |
| grass | a sward of grass, fine strokes leaning with the wind, in waves when it blows |
| sand | sand in dunes: ridges across the wind, gentle on the windward side, a sharp slip face in lee |
| pavement | desert pavement: a scatter of pebbles over pale ground |
| salt | a salt flat: white, cracked into polygons |
| polygons | patterned ground of the permafrost: ice-wedge polygons |
| moss | moss and lichen: soft mats, pale green and grey |
| scree | bare rock, scree and boulders |
| ice | ice: crevasses, and sastrugi carved by the wind |
| water | open water between the plants: channels, pools, flood |
| mud | tidal mud, laced with channels |

## The year

| phenology | how it turns | phases |
|---|---|---|
| evergreen | green all year | always green |
| deciduous | leaves out in spring, full in summer, turning red and gold as the month's mean falls under 10 C, bare under 5 C | green from 10 C; fresh between 5 and 10 C while warming; turning between 5 and 10 C while cooling; bare under 5 C |
| boreal | the conifers green all year; the birch, aspen and larch among them turning gold in autumn and bare in winter | as deciduous, for the colour of the broadleaves among the conifers |
| wet-dry | green in the wet months, gold and leafless in the dry ones; flowering trees at the end of the dry season | green with 3 mm of rain a day or more; dry under 1 mm; between, green if the next month is wetter, dry if not |
| mediterranean | green through the wet winter, gold through the dry summer | green with 1.5 mm of rain a day or more and a mean under 20 C; dry otherwise |
| tundra | under snow most of the year; a short summer flush of green and tiny flowers | green above 3 C; bare otherwise |
| desert | bare, blooming only after the rare wet month | bloom when the month's rain is at least 1 mm a day and twice the year's mean; bare otherwise |
| ice | white all year | always bare |
| grassland | dormant and brown in the cold; greening in spring; gold where the summer is dry, green where it is wet | bare under 5 C; dry with under 1.5 mm of rain a day; fresh between 5 and 10 C while warming; green otherwise |

## Clouds by regime

| regime | from above | share of sky |
|---|---|---|
| clear | no cloud; at most a contrail | 0 |
| deep convection | towers 34-89 cells across with bubbling edges, anvils streaming downwind, rain shafts under | 0.618 |
| trade cumulus | small puffs 5-13 cells across in streets along the wind, their shadows beside them | 0.382 |
| stratocumulus deck | a closed-cell honeycomb sheet, cells 13-21 cells across, with pockets of open cells | 0.8541 |
| coastal fog | a smooth, low veil lying on the coast and in the valleys | 0.618 |
| storm track | long curved frontal bands and comma-shaped storms, raining | 0.7639 |
| polar stratus | a near-uniform grey sheet, faintly textured | 0.8541 |
| orographic | caps on the summits, banners from them, and smooth lens-shaped wave clouds downwind | 0.382 |
| cirrus | thin, fibrous streaks along the upper wind, half transparent | 0.382 |
| fair cumulus | scattered cotton-ball puffs with crisp shadows | 0.382 |
| broken | broken patches of cumulus and stratus | 0.618 |

## Kinds of life

| kind | behaviour | when |
|---|---|---|
| ants | colonial foragers in columns between nest and food | temp_min 8 |
| mould | slime mould or fungal network pouring from bright spots | temp_min 5, snow_max 0.2 |
| frogs | small hoppers that sit, hop and call in turn (frogs, lizards, mudskippers, crabs) | temp_min 10 |
| ferns | fronds unrolling from fiddleheads | temp_min 3, snow_max 0.5 |
| snakes | a banded body winding along (snakes, slugs, and crocodilians in water) | temp_min 13 |
| fireflies | lights that flash and fall into flashing as one | temp_min 15 |
| morphos | butterflies: an erratic, bobbing, flashing flight | temp_min 12 |
| wind | gusts crossing the crowns, turning leaves pale | always |
| blooms | flowers opening florets by the golden angle | temp_min 5, snow_max 0.2, phases ['green', 'fresh', 'bloom'] |
| hummers | hoverers that dart between flowers (hummingbirds, sunbirds, honeyeaters) | temp_min 10 |
| troops | a group crossing the crowns in single file, leaping gaps (monkeys, squirrels, lemurs) | temp_min 0 |
| macaws | pairs crossing high and fast between the tallest trees (parrots, hornbills, cockatoos) | always |
| eagles | a raptor circling high, seen only as its shadow | always |
| flocks | birds wheeling as one (the loose dots of DIRT's data pigment) | always |
| herds | grazers moving together over open ground, grazing, then moving on in long files | snow_max 0.95 |
| hunters | a predator or pack that shadows a herd and at times runs at it | snow_max 0.95 |
| colonies | a crowd that stays put and seethes: termite mounds, prairie-dog towns, penguins, seals | always |
| swarms | a dense, jittering cloud: mosquitoes, midges, locusts, bees, quelea | temp_min 10 |
| waders | tall birds standing in shallow water, stepping and stabbing (flamingos, herons, storks) | temp_min 0 |
| vees | migrating geese and cranes in V formations, in their seasons | months [2, 3, 4, 8, 9, 10] |
| soarers | vultures and condors circling on thermals, their shadows below | temp_min 5 |
| schools | fish that turn together and flash as they turn | ice_max 0.8 |
| whales | a great body surfacing, blowing, and sinking again (whales, rays, turtles) | always |
| floes | floes that drift and part: sea ice, or rafts of sargassum | always |
| grasswaves | wind waves running through grass | snow_max 0.5 |
| dunes | sand blowing off the dune crests | snow_max 0.2 |
| dust | dust devils wandering over hot, dry ground | rain_max 1.0, temp_min 15 |
| leaffall | leaves turning and falling in autumn | phases ['turning'] |
| fire | a creeping line of flame through dry grass, leaving a black scar and trailing smoke | phases ['dry'] |
| bioluminescence | the sea sparkling where it is stirred, and in the dark | always |

## Biomes

### Tropical & Subtropical Moist Broadleaf Forests

Ground: litter. Year: evergreen. Looks: green *rainforest*. Typical canopy 30 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| understory | lobed | 21 / 13 | 0.2361-0.382 | 0.618 | Neotropic: heliconias, understory palms, cacao; Afrotropic: arrowroot thickets, wild coffee; Indomalayan: rattan palms, wild gingers; Australasia: tree ferns, pandanus; Oceania: tree ferns, pandanus |
| canopy | lobed | 55 / 34 | 0.4721-0.7639 | 0.7639 | Neotropic: Brazil nut, cecropia, strangler fig, big-leaf mahogany; Afrotropic: African mahogany, iroko, okoume; Indomalayan: dipterocarps, figs; Australasia: Queensland kauri, figs; Oceania: breadfruit, Pacific rosewood |
| emergents | lobed | 233 / 55 | 0.8541-1 | 0.618 | Neotropic: kapok; Afrotropic: moabi, sapele; Indomalayan: tualang, yellow meranti; Australasia: klinki pine; Oceania: banyan |

| height | kind | species by realm |
|---|---|---|
| floor | ants | Neotropic: leafcutter ants, army ants; Afrotropic: driver ants; Indomalayan: giant forest ants; Australasia: bull ants; Oceania: ants |
| floor | frogs | Neotropic: poison dart frogs; Afrotropic: reed frogs; Indomalayan: Wallace's flying frogs; Australasia: green tree frogs; Oceania: geckos |
| floor | ferns | Neotropic: maidenhair ferns; Afrotropic: forest ferns; Indomalayan: bird's-nest ferns; Australasia: king ferns; Oceania: ferns |
| floor | mould | *: slime mould (Physarum) |
| understory | snakes | Neotropic: coral snakes; Afrotropic: Gaboon vipers; Indomalayan: king cobras; Australasia: green pythons; Oceania: Pacific boas |
| understory | fireflies | Neotropic: fireflies; Afrotropic: fireflies; Indomalayan: synchronous fireflies; Australasia: fireflies; Oceania: fireflies |
| understory | morphos | Neotropic: blue morphos; Afrotropic: African giant swallowtails; Indomalayan: Rajah Brooke's birdwings; Australasia: Ulysses butterflies; Oceania: eggfly butterflies |
| crowns | blooms | Neotropic: bromeliads and orchids; Afrotropic: African tulip trees; Indomalayan: orchids; Australasia: umbrella tree flowers; Oceania: hibiscus |
| crowns | hummers | Neotropic: hummingbirds; Afrotropic: sunbirds; Indomalayan: spiderhunters; Australasia: honeyeaters; Oceania: honeyeaters |
| crowns | troops | Neotropic: spider monkeys, howler monkeys, golden lion tamarins; Afrotropic: colobus monkeys, chimpanzees, lemurs; Indomalayan: gibbons, orangutans; Australasia: tree kangaroos |
| crowns | wind | *: wind in the crowns |
| above | macaws | Neotropic: scarlet macaws; Afrotropic: African grey parrots; Indomalayan: rhinoceros hornbills; Australasia: sulphur-crested cockatoos; Oceania: lorikeets |
| above | eagles | Neotropic: harpy eagle; Afrotropic: crowned eagle; Indomalayan: Philippine eagle; Australasia: New Guinea harpy eagle; Oceania: Fiji goshawk |
| above | flocks | Neotropic: parakeets; Afrotropic: green pigeons; Indomalayan: green pigeons; Australasia: rainbow lorikeets; Oceania: fruit doves |

### Tropical & Subtropical Dry Broadleaf Forests

Ground: litter. Year: wet-dry. Looks: green *dry forest*, dry *dry forest, dry*. Typical canopy 15 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| thorn scrub | lobed | 21 / 8 | 0.2361-0.382 | 0.618 | Neotropic: acacia scrub; Indomalayan: lantana, jujube; Afrotropic: spiny forest; Australasia: vine thicket |
| canopy | lobed | 34 / 21 | 0.382-0.618 | 0.618 | Indomalayan: teak, sal; Neotropic: guanacaste, gumbo-limbo, pink lapacho; Afrotropic: tamarind, mopane; Australasia: monsoon vine thicket; Oceania: sandalwood |
| emergents | umbrella | 144 / 34 | 0.618-0.7639 | 0.2361 | Afrotropic: Grandidier's baobab; Neotropic: pochote; Indomalayan: red silk-cotton |

| height | kind | species by realm |
|---|---|---|
| floor | ants | *: ants |
| floor | frogs | Neotropic: spiny-tailed iguanas; Indomalayan: garden lizards; Afrotropic: chameleons; Australasia: frilled lizards |
| understory | snakes | Indomalayan: Indian cobras; Neotropic: boa constrictors; Afrotropic: Madagascar tree boas |
| understory | morphos | Indomalayan: common Mormons; Neotropic: migrating sulphurs; Afrotropic: comet moths |
| understory | herds | Indomalayan: chital, gaur, sambar; Neotropic: white-tailed deer, collared peccaries; Afrotropic: bushpigs |
| understory | hunters | Indomalayan: Bengal tiger, leopard, dholes; Neotropic: jaguar, puma; Afrotropic: fossa |
| crowns | blooms | Neotropic: pink lapacho in flower; Indomalayan: flame of the forest in flower; Afrotropic: baobab flowers |
| crowns | troops | Indomalayan: grey langurs, rhesus macaques; Neotropic: white-faced capuchins; Afrotropic: Verreaux's sifakas |
| crowns | leaffall | *: leaves falling in the dry season |
| above | soarers | Indomalayan: white-rumped vultures; Neotropic: black vultures; Afrotropic: yellow-billed kites; Australasia: black kites |
| above | flocks | Indomalayan: rose-ringed parakeets; Neotropic: orange-fronted parakeets; Afrotropic: vasa parrots; Australasia: red-tailed black cockatoos |

### Tropical & Subtropical Coniferous Forests

Ground: litter. Year: evergreen. Looks: green *tropical pines*. Typical canopy 20 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| shrubs | lobed | 21 / 8 | 0.2361-0.382 | 0.382 | Neotropic: manzanita, oaks; Indomalayan: rhododendrons |
| pines | cone | 21 / 8 | 0.618-0.7639 | 0.7639 | Neotropic: Montezuma pine, Caribbean pine, sacred fir (oyamel); Indomalayan: Khasi pine, chir pine |

| height | kind | species by realm |
|---|---|---|
| floor | ants | *: ants |
| understory | morphos | Neotropic: monarch butterflies in their winter clusters; Indomalayan: swallowtails |
| understory | herds | Neotropic: white-tailed deer; Indomalayan: goral |
| crowns | troops | Neotropic: Mexican grey squirrels; Indomalayan: Himalayan striped squirrels |
| crowns | wind | *: wind in the pines |
| above | soarers | Neotropic: turkey vultures; Indomalayan: Himalayan griffons |
| above | flocks | Neotropic: thick-billed parrots; Indomalayan: scarlet minivets |

### Temperate Broadleaf & Mixed Forests

Ground: litter. Year: deciduous. Looks: green *temperate forest*, fresh *temperate forest, fresh*, turning *temperate forest, turning*, bare *temperate forest, bare*. Typical canopy 25 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| shrubs | lobed | 21 / 8 | 0.2361-0.382 | 0.618 | Palearctic: hazel, holly; Nearctic: dogwood, mountain laurel; Australasia: tree ferns; Neotropic: chusquea bamboo; Indomalayan: rhododendrons |
| canopy | lobed | 55 / 21 | 0.4721-0.7639 | 0.7639 | Palearctic: European beech, pedunculate oak, hornbeam, maples; Nearctic: sugar maple, white oak, American beech, tulip tree; Australasia: southern beech; Neotropic: coigue (southern beech); Indomalayan: oaks and chestnuts |
| tall trees | lobed | 144 / 34 | 0.7639-0.8541 | 0.2361 | Palearctic: ancient oaks; Nearctic: eastern white pine, tulip tree; Australasia: kahikatea, rimu; Neotropic: alerce; Indomalayan: walnuts |

| height | kind | species by realm |
|---|---|---|
| floor | ants | *: wood ants |
| floor | ferns | Palearctic: bracken; Nearctic: Christmas ferns; Australasia: crown ferns; Neotropic: ferns; Indomalayan: ferns |
| floor | mould | *: slime mould |
| floor | frogs | Palearctic: common frogs; Nearctic: spring peepers; Australasia: Hochstetter's frogs; Neotropic: Darwin's frogs |
| understory | fireflies | Palearctic: glow-worms; Nearctic: fireflies; Indomalayan: fireflies |
| understory | morphos | Palearctic: peacock butterflies; Nearctic: tiger swallowtails; Australasia: red admirals; Indomalayan: swallowtails |
| understory | herds | Palearctic: red deer, wild boar; Nearctic: white-tailed deer; Neotropic: pudu; Australasia: red deer; Indomalayan: sika deer |
| understory | hunters | Palearctic: wolves, red foxes; Nearctic: black bears, coyotes; Neotropic: kodkod |
| understory | snakes | Palearctic: adders; Nearctic: garter snakes |
| crowns | blooms | Palearctic: cherry blossom; Nearctic: dogwood blossom; Australasia: southern rata; Indomalayan: magnolias |
| crowns | troops | Palearctic: red squirrels; Nearctic: grey squirrels; Australasia: brushtail possums; Neotropic: monito del monte; Indomalayan: Japanese macaques |
| crowns | leaffall | *: autumn leaves |
| crowns | wind | *: wind in the crowns |
| above | flocks | Palearctic: starling murmurations; Nearctic: common grackles; Australasia: tui; Neotropic: austral parakeets; Indomalayan: azure-winged magpies |
| above | vees | Palearctic: greylag geese; Nearctic: Canada geese; Indomalayan: swan geese |
| above | eagles | Palearctic: white-tailed eagle; Nearctic: bald eagle; Australasia: swamp harrier; Neotropic: black-chested buzzard-eagle; Indomalayan: mountain hawk-eagle |

### Temperate Conifer Forests

Ground: moss. Year: evergreen. Looks: green *conifer forest*. Typical canopy 30 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| ferns and shrubs | lobed | 21 / 8 | 0.2361-0.382 | 0.618 | Nearctic: sword ferns, salal; Palearctic: bilberry; Indomalayan: rhododendrons |
| conifers | cone | 34 / 13 | 0.618-0.7639 | 0.7639 | Nearctic: Douglas fir, western red cedar, Sitka spruce, ponderosa pine; Palearctic: Norway spruce, silver fir, Scots pine, deodar, Japanese cedar; Indomalayan: Himalayan hemlock |
| giants | cone | 144 / 21 | 0.8541-1 | 0.2361 | Nearctic: coast redwood, giant sequoia; Palearctic: ancient Japanese cedar |

| height | kind | species by realm |
|---|---|---|
| floor | ferns | Nearctic: sword ferns; Palearctic: lady ferns; Indomalayan: ferns |
| floor | mould | *: slime mould |
| floor | snakes | Nearctic: banana slugs, rubber boas; Palearctic: Aesculapian snakes |
| understory | herds | Nearctic: Roosevelt elk; Palearctic: red deer; Indomalayan: musk deer |
| understory | hunters | Nearctic: black bears, cougars; Palearctic: brown bears, Eurasian lynx; Indomalayan: Asiatic black bears |
| crowns | troops | Nearctic: Douglas squirrels; Palearctic: red squirrels; Indomalayan: red pandas |
| crowns | wind | *: wind in the conifers |
| above | eagles | Nearctic: bald eagle; Palearctic: golden eagle; Indomalayan: golden eagle |
| above | flocks | Nearctic: crossbills; Palearctic: crossbills, nutcrackers; Indomalayan: grosbeaks |

### Boreal Forests/Taiga

Ground: moss. Year: boreal. Looks: green *taiga*, fresh *taiga*, turning *taiga, turning*, bare *taiga*. Typical canopy 12 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| dwarf shrubs and bog | cushion | 13 / 5 | 0.1459-0.2361 | 0.618 | Nearctic: Labrador tea, sphagnum bog; Palearctic: bilberry, sphagnum bog |
| spruce and larch | cone | 21 / 8 | 0.382-0.618 | 0.618 | Nearctic: black spruce, white spruce, tamarack, jack pine; Palearctic: Siberian larch, Siberian pine, Scots pine, Norway spruce |
| birch and aspen (turns) | lobed | 89 / 21 | 0.382-0.618 | 0.2361 | Nearctic: paper birch, trembling aspen; Palearctic: downy birch, aspen |

| height | kind | species by realm |
|---|---|---|
| floor | mould | *: slime mould |
| floor | swarms | Nearctic: mosquitoes and blackflies; Palearctic: mosquitoes |
| floor | frogs | Nearctic: wood frogs; Palearctic: moor frogs |
| understory | herds | Nearctic: moose, woodland caribou; Palearctic: elk (moose), reindeer |
| understory | hunters | Nearctic: grey wolves, Canada lynx; Palearctic: wolves, Amur tiger, brown bears |
| crowns | troops | Nearctic: red squirrels; Palearctic: red squirrels, sable |
| crowns | leaffall | *: birch and larch turning gold |
| above | vees | Nearctic: sandhill cranes, Canada geese; Palearctic: Siberian cranes, bean geese |
| above | eagles | Nearctic: bald eagle; Palearctic: golden eagle |

### Tropical & Subtropical Grasslands, Savannas & Shrublands

Ground: grass. Year: wet-dry. Looks: green *savanna*, dry *savanna, dry*. Typical canopy 5 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| grass | tussock | 5 / 2 | 0.0902-0.1459 | 0.8541 | Afrotropic: red oat grass; Neotropic: cerrado grasses; Australasia: spinifex; Indomalayan: elephant grass |
| shrubs | lobed | 34 / 5 | 0.1459-0.2361 | 0.2361 | Afrotropic: whistling thorn; Neotropic: pequi; Australasia: wattles; Indomalayan: jujube |
| acacias and baobabs | umbrella | 89 / 21 | 0.382-0.618 | 0.2361 | Afrotropic: umbrella thorn acacia, baobab, yellow fever tree; Neotropic: pau-terra; Australasia: Darwin woollybutt; Indomalayan: silk-cotton trees |

| height | kind | species by realm |
|---|---|---|
| floor | colonies | Afrotropic: termite mounds; Neotropic: termite mounds; Australasia: cathedral termite mounds; Indomalayan: termite mounds |
| floor | grasswaves | *: wind in the grass |
| floor | fire | Afrotropic: grass fire; Neotropic: cerrado fire; Australasia: grass fire, followed by fire-hawk kites; Indomalayan: grass fire |
| floor | ants | *: ants |
| understory | herds | Afrotropic: blue wildebeest, plains zebra, Thomson's gazelle, African elephants, giraffes, Cape buffalo, impala; Neotropic: capybara, pampas deer, greater rheas; Australasia: agile wallabies, emus; Indomalayan: swamp deer, Indian rhinoceros, hog deer |
| understory | hunters | Afrotropic: a lion pride, cheetahs, a spotted hyena clan, African wild dogs; Neotropic: maned wolf, jaguar; Australasia: dingoes; Indomalayan: Bengal tiger |
| crowns | blooms | Afrotropic: acacia blossom; Neotropic: ipe in flower; Australasia: grevilleas; Indomalayan: silk-cotton blossom |
| above | soarers | Afrotropic: white-backed vultures, Rüppell's vultures; Neotropic: king vultures; Australasia: black kites; Indomalayan: red-headed vultures |
| above | swarms | Afrotropic: red-billed quelea, desert locusts; Australasia: grasshoppers; Neotropic: locusts; Indomalayan: locusts |
| above | flocks | Afrotropic: weaverbirds; Neotropic: blue-and-yellow macaws; Australasia: galahs; Indomalayan: common mynas |

### Temperate Grasslands, Savannas & Shrublands

Ground: grass. Year: grassland. Looks: green *grassland*, fresh *grassland*, dry *grassland, dry*, bare *grassland, dry*. Typical canopy 1 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| grass | tussock | 3 / 1 | 0.0557-0.0902 | 0.9098 | Nearctic: big bluestem, buffalo grass, switchgrass; Palearctic: feather grass, fescue; Neotropic: pampas grass, coiron tussocks; Australasia: tussock grass; Afrotropic: red grass |
| forbs and shrubs | cushion | 21 / 3 | 0.0902-0.1459 | 0.2361 | Nearctic: sunflowers, coneflowers, sagebrush; Palearctic: wormwood, wild tulips; Neotropic: verbena, calafate; Australasia: everlasting daisies; Afrotropic: karoo bushes |

| height | kind | species by realm |
|---|---|---|
| floor | colonies | Nearctic: a prairie-dog town; Palearctic: bobak marmots, sousliks; Neotropic: viscachas, burrowing owls; Afrotropic: ground squirrels |
| floor | grasswaves | *: wind in the grass |
| floor | blooms | Nearctic: prairie wildflowers; Palearctic: wild tulips; Neotropic: verbena; Australasia: everlasting daisies; Afrotropic: daisies |
| floor | fire | Nearctic: prairie fire; Neotropic: pampas fire; Australasia: grass fire; Afrotropic: veld fire |
| understory | herds | Nearctic: American bison, pronghorn; Palearctic: saiga, Mongolian gazelles, Przewalski's horses; Neotropic: guanacos, pampas deer, greater rheas; Australasia: eastern grey kangaroos; Afrotropic: springbok, black wildebeest |
| understory | hunters | Nearctic: coyotes, grey wolves; Palearctic: wolves, corsac foxes; Neotropic: pampas foxes, puma; Afrotropic: black-backed jackals |
| above | soarers | Nearctic: red-tailed hawks, turkey vultures; Palearctic: steppe eagles, cinereous vultures; Neotropic: chimango caracaras; Australasia: wedge-tailed eagles; Afrotropic: Cape vultures |
| above | vees | Nearctic: snow geese, sandhill cranes; Palearctic: demoiselle cranes, red-breasted geese; Neotropic: upland geese |
| above | flocks | Nearctic: red-winged blackbirds; Palearctic: rosy starlings; Neotropic: eared doves; Australasia: budgerigars; Afrotropic: larks |

### Flooded Grasslands & Savannas

Ground: water. Year: wet-dry. Looks: green *wetland*, dry *wetland, dry*. Typical canopy 2 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| reeds and papyrus | reed | 5 / 2 | 0.0902-0.1459 | 0.618 | Afrotropic: papyrus, reeds; Neotropic: water hyacinth, giant water lily; Nearctic: sawgrass; Indomalayan: reeds; Palearctic: reeds; Australasia: wild rice |
| islands of trees | lobed | 89 / 21 | 0.382-0.618 | 0.2361 | Afrotropic: jackalberry, wild date palms; Neotropic: caranda palms, piuva; Nearctic: bald cypress domes; Indomalayan: tamarisks; Palearctic: willows; Australasia: paperbarks |

| height | kind | species by realm |
|---|---|---|
| floor | waders | Neotropic: jabirus, roseate spoonbills; Afrotropic: shoebills, African spoonbills; Nearctic: wood storks, great egrets; Indomalayan: greater flamingos, painted storks; Palearctic: grey herons, greater flamingos; Australasia: brolgas |
| floor | snakes | Neotropic: yacare caimans, yellow anacondas; Afrotropic: Nile crocodiles; Nearctic: American alligators; Indomalayan: mugger crocodiles; Australasia: freshwater crocodiles |
| floor | frogs | Neotropic: paradoxical frogs; Afrotropic: painted reed frogs; Nearctic: pig frogs; Indomalayan: frogs; Palearctic: marsh frogs; Australasia: frogs |
| floor | schools | Neotropic: piranhas; Afrotropic: tigerfish; Nearctic: gar; Indomalayan: catfish; Palearctic: carp; Australasia: barramundi |
| understory | herds | Neotropic: capybara, marsh deer; Afrotropic: red lechwe, hippopotamus, sitatunga; Nearctic: white-tailed deer; Indomalayan: Indian wild ass; Australasia: water buffalo |
| understory | swarms | *: mosquitoes |
| above | flocks | Neotropic: hyacinth macaws; Afrotropic: open-billed storks; Nearctic: white ibises; Indomalayan: whistling ducks; Palearctic: pelicans; Australasia: magpie geese |
| above | eagles | Afrotropic: African fish eagle; Neotropic: snail kite; Nearctic: osprey; Indomalayan: Pallas's fish eagle; Palearctic: marsh harrier; Australasia: white-bellied sea eagle |

### Montane Grasslands & Shrublands

Ground: scree. Year: tundra. Looks: green *montane*, bare *tundra, bare*. Typical canopy 1 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| cushions and tussocks | cushion | 8 / 2 | 0.0557-0.0902 | 0.7639 | Neotropic: ichu grass, yareta cushions; Afrotropic: tussock grass, everlastings; Palearctic: Kobresia meadows, cushion plants; Indomalayan: rhododendron scrub; Australasia: snow tussock; Nearctic: alpine sedges |
| giant rosettes | rosette | 34 / 5 | 0.1459-0.2361 | 0.2361 | Neotropic: frailejones, Puya raimondii; Afrotropic: giant lobelias, giant groundsels |

| height | kind | species by realm |
|---|---|---|
| floor | blooms | Neotropic: Puya in flower; Afrotropic: Erica flowers; Palearctic: edelweiss, saussureas; Indomalayan: blue poppies; Australasia: mountain daisies; Nearctic: alpine forget-me-nots |
| floor | colonies | Neotropic: viscachas; Palearctic: pikas, marmots; Afrotropic: giant mole-rats; Indomalayan: pikas; Nearctic: marmots |
| floor | waders | Neotropic: Andean and James's flamingos; Palearctic: black-necked cranes |
| understory | herds | Neotropic: vicuñas, llamas and alpacas; Afrotropic: geladas, walia ibex; Palearctic: wild yak, Tibetan antelope, kiang; Indomalayan: blue sheep; Nearctic: mountain goats; Australasia: Himalayan tahr |
| understory | hunters | Neotropic: Andean foxes, puma; Afrotropic: Ethiopian wolves; Palearctic: snow leopard, Tibetan wolves; Indomalayan: snow leopard; Nearctic: cougars |
| above | soarers | Neotropic: Andean condors; Afrotropic: lammergeiers; Palearctic: Himalayan griffons, lammergeiers; Indomalayan: Himalayan griffons; Nearctic: golden eagles; Australasia: keas |
| above | vees | Palearctic: bar-headed geese, black-necked cranes; Neotropic: Andean geese |

### Tundra

Ground: polygons. Year: tundra. Looks: green *tundra*, bare *tundra, bare*. Typical canopy 0.3 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| lichen and moss | cushion | 5 / 2 | 0.0344-0.0557 | 0.7639 | Nearctic: reindeer lichen, cotton grass, sphagnum; Palearctic: reindeer lichen, cotton grass, sphagnum; Antarctica: mosses and lichens |
| dwarf willow and birch | cushion | 13 / 3 | 0.0557-0.0902 | 0.382 | Nearctic: arctic willow, dwarf birch; Palearctic: dwarf birch, cloudberry |

| height | kind | species by realm |
|---|---|---|
| floor | blooms | Nearctic: purple saxifrage, arctic poppies; Palearctic: arctic poppies, cloudberry flowers; Antarctica: Antarctic pearlwort |
| floor | colonies | Nearctic: lemmings; Palearctic: lemmings; Antarctica: Adelie penguins, gentoo penguins |
| floor | swarms | Nearctic: mosquitoes; Palearctic: mosquitoes |
| understory | herds | Nearctic: caribou, muskoxen; Palearctic: reindeer |
| understory | hunters | Nearctic: arctic foxes, grey wolves, grizzly bears; Palearctic: arctic foxes, wolves |
| above | vees | Nearctic: snow geese; Palearctic: barnacle geese, brent geese |
| above | eagles | Nearctic: snowy owl, gyrfalcon; Palearctic: snowy owl, rough-legged buzzard; Antarctica: south polar skua |
| above | flocks | Nearctic: snow buntings; Palearctic: snow buntings; Antarctica: snow petrels |

### Mediterranean Forests, Woodlands & Scrub

Ground: pavement. Year: mediterranean. Looks: green *mediterranean*, dry *mediterranean, dry*. Typical canopy 6 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| scrub (maquis, chaparral, fynbos, kwongan, matorral) | cushion | 13 / 5 | 0.1459-0.2361 | 0.7639 | Palearctic: lavender, rosemary, rockrose; Nearctic: chamise, manzanita; Afrotropic: king protea, restios, ericas; Australasia: banksias, kangaroo paw; Neotropic: quillay, boldo |
| oaks, olives, pines | lobed | 55 / 13 | 0.382-0.618 | 0.382 | Palearctic: olive, cork oak, holm oak, stone pine; Nearctic: coast live oak, blue oak; Afrotropic: silver tree; Australasia: jarrah, marri; Neotropic: Chilean wine palm, peumo |

| height | kind | species by realm |
|---|---|---|
| floor | blooms | Palearctic: poppies and orchids; Nearctic: California poppies; Afrotropic: proteas; Australasia: kangaroo paw; Neotropic: añañucas |
| floor | frogs | Palearctic: ocellated lizards; Nearctic: fence lizards; Afrotropic: girdled lizards; Australasia: bobtail skinks; Neotropic: Liolaemus lizards |
| floor | ants | *: harvester ants; Australasia: bull ants |
| understory | herds | Palearctic: Iberian ibex, mouflon; Nearctic: mule deer; Afrotropic: bontebok; Australasia: western grey kangaroos; Neotropic: guanacos |
| understory | hunters | Palearctic: Iberian lynx; Nearctic: coyotes, bobcats; Afrotropic: caracals; Australasia: dingoes; Neotropic: culpeo foxes |
| understory | swarms | Palearctic: cicadas, honey bees; Nearctic: honey bees; Afrotropic: Cape honey bees; Australasia: native bees; Neotropic: bees |
| understory | fire | Palearctic: wildfire; Nearctic: chaparral fire; Australasia: bushfire; Afrotropic: fynbos fire; Neotropic: matorral fire |
| crowns | hummers | Palearctic: hummingbird hawk-moths; Nearctic: Anna's hummingbirds; Afrotropic: orange-breasted sunbirds, Cape sugarbirds; Australasia: honey possums, wattlebirds; Neotropic: green-backed firecrowns |
| crowns | wind | *: wind in the scrub |
| above | soarers | Palearctic: griffon vultures; Nearctic: California condors, turkey vultures; Afrotropic: Cape vultures; Australasia: wedge-tailed eagles; Neotropic: Andean condors |
| above | eagles | Palearctic: Bonelli's eagle; Nearctic: golden eagle; Afrotropic: Verreaux's eagle; Australasia: wedge-tailed eagle; Neotropic: black-chested buzzard-eagle |
| above | flocks | Palearctic: bee-eaters; Nearctic: California quail; Australasia: Carnaby's black cockatoos; Afrotropic: Cape canaries; Neotropic: austral thrushes |

### Deserts & Xeric Shrublands

Ground: sand. Year: desert. Looks: bare *desert*, green *desert*, bloom *desert, bloom*. Typical canopy 1 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| desert shrubs | cushion | 21 / 3 | 0.0902-0.1459 | 0.382 | Palearctic: saxaul, tamarisk, camelthorn; Nearctic: creosote bush, sagebrush, ocotillo; Afrotropic: welwitschia, !nara melon, lithops; Australasia: spinifex, saltbush, mulga; Neotropic: tola shrubs; Indomalayan: phog |
| cacti, Joshua trees, quiver trees | column | 55 / 2 | 0.2361-0.382 | 0.2361 | Nearctic: saguaro, Joshua tree, organ pipe cactus; Afrotropic: quiver trees; Neotropic: cardon cactus, copiapoa; Palearctic: Euphorbia resinifera; Australasia: desert oaks |

| height | kind | species by realm |
|---|---|---|
| floor | dunes | *: sand blowing off the dunes |
| floor | ants | Palearctic: Saharan silver ants; Nearctic: harvester ants; Afrotropic: fog-basking beetles; Australasia: honeypot ants; Neotropic: darkling beetles; Indomalayan: harvester ants |
| floor | frogs | Palearctic: spiny-tailed lizards; Nearctic: desert horned lizards; Afrotropic: Namib web-footed geckos; Australasia: thorny devils; Neotropic: lava lizards; Indomalayan: spiny-tailed lizards |
| floor | snakes | Palearctic: horned vipers; Nearctic: sidewinders; Afrotropic: Peringuey's adders; Australasia: inland taipans; Neotropic: Peruvian racers; Indomalayan: saw-scaled vipers |
| floor | blooms | Nearctic: desert wildflowers after rain; Neotropic: the flowering desert; Afrotropic: Namaqualand daisies; Australasia: Sturt's desert pea; Palearctic: desert blooms after rain; Indomalayan: desert blooms after rain |
| floor | colonies | Afrotropic: meerkats; Nearctic: kangaroo rats; Palearctic: great gerbils; Australasia: bilbies |
| understory | herds | Palearctic: dromedaries, addax, dorcas gazelles; Nearctic: desert bighorn sheep, pronghorn; Afrotropic: gemsbok, springbok; Australasia: red kangaroos, emus; Neotropic: guanacos; Indomalayan: blackbuck, chinkara |
| understory | hunters | Palearctic: fennec foxes, golden jackals; Nearctic: coyotes; Afrotropic: brown hyenas, black-backed jackals; Australasia: dingoes; Neotropic: culpeo foxes; Indomalayan: Indian wolves |
| understory | dust | *: dust devils |
| above | soarers | Palearctic: lappet-faced vultures; Nearctic: turkey vultures, Harris's hawks; Afrotropic: lappet-faced vultures; Australasia: wedge-tailed eagles; Neotropic: turkey vultures; Indomalayan: Egyptian vultures |
| above | swarms | Palearctic: desert locusts; Australasia: budgerigar flocks; Afrotropic: desert locusts; Indomalayan: desert locusts |

### Mangroves

Ground: mud. Year: evergreen. Looks: green *mangrove*. Typical canopy 10 m.

| stratum | crown | spacing / reach | height | cover | plants |
|---|---|---|---|---|---|
| mangroves | mangrove | 21 / 13 | 0.382-0.618 | 0.7639 | Indomalayan: sundari, Rhizophora, nipa palm; Neotropic: red mangrove, black mangrove; Australasia: grey mangrove; Afrotropic: Rhizophora, Avicennia; Nearctic: red mangrove; Oceania: Rhizophora; Palearctic: grey mangrove |

| height | kind | species by realm |
|---|---|---|
| floor | frogs | Indomalayan: mudskippers, fiddler crabs; Neotropic: fiddler crabs, mangrove crabs; Australasia: mudskippers, mud crabs; Afrotropic: mudskippers, fiddler crabs; *: fiddler crabs |
| floor | schools | *: young fish among the roots |
| floor | snakes | Indomalayan: estuarine crocodiles, mangrove pit vipers; Neotropic: American crocodiles; Australasia: saltwater crocodiles; Afrotropic: Nile crocodiles; Nearctic: American crocodiles |
| crowns | troops | Indomalayan: proboscis monkeys, long-tailed macaques; Neotropic: white-faced capuchins; Afrotropic: vervet monkeys |
| crowns | hummers | Indomalayan: kingfishers; Neotropic: hummingbirds; Australasia: mangrove honeyeaters; *: kingfishers |
| above | waders | Indomalayan: painted storks, egrets; Neotropic: scarlet ibises, roseate spoonbills; Australasia: royal spoonbills; Afrotropic: goliath herons; *: egrets |
| above | flocks | Neotropic: frigatebirds; Indomalayan: flying foxes at dusk; Australasia: flying foxes; *: egrets |

### Rock & Ice

Ground: ice. Year: ice. Looks: bare *ice*. Typical canopy 0 m.

| height | kind | species by realm |
|---|---|---|
| floor | colonies | Antarctica: emperor penguins |
| understory | hunters | Nearctic: a polar bear; Palearctic: a polar bear |
| above | flocks | Antarctica: snow petrels; Nearctic: ivory gulls; Palearctic: ivory gulls |
| above | vees | Palearctic: bar-headed geese crossing the Himalaya |
| above | soarers | Palearctic: lammergeiers |

## The sea

| zone | look | kind | species |
|---|---|---|---|
| sea ice | ice | floes | *: pack ice |
| sea ice | ice | colonies | north: walruses, ringed seals; south: emperor penguins, crabeater seals, Weddell seals |
| sea ice | ice | whales | north: narwhals, belugas, bowhead whales; south: Antarctic minke whales, orcas |
| sea ice | ice | hunters | north: polar bears; south: leopard seals |
| sea ice | ice | schools | north: Arctic cod; south: Antarctic krill |
| reef | sea, tropical shallows | schools | *: parrotfish, fusiliers, clownfish |
| reef | sea, tropical shallows | snakes | *: sea snakes, moray eels |
| reef | sea, tropical shallows | whales | *: manta rays, green turtles, reef sharks |
| reef | sea, tropical shallows | flocks | *: frigatebirds, noddies |
| upwelling | sea, upwelling | schools | *: anchoveta and sardines in bait balls |
| upwelling | sea, upwelling | whales | *: humpback whales, blue whales |
| upwelling | sea, upwelling | flocks | south: guanay cormorants, boobies diving; north: pelicans, gannets diving |
| upwelling | sea, upwelling | colonies | *: sea lions; south: Humboldt penguins, Cape fur seals |
| upwelling | sea, upwelling | bioluminescence | *: plankton glowing |
| gyre | sea, tropical | schools | *: flying fish, tuna |
| gyre | sea, tropical | flocks | *: albatrosses, shearwaters |
| gyre | sea, tropical | floes | north: sargassum rafts |
| gyre | sea, tropical | whales | *: sperm whales |
| shelf | by its warmth | schools | north: herring, cod; south: pilchards; *: mackerel |
| shelf | by its warmth | whales | *: dolphins, grey whales |
| shelf | by its warmth | colonies | north: harbour seals, gannets; south: fur seals |
| shelf | by its warmth | flocks | *: gulls, gannets diving |
| slope | by its warmth | whales | *: sperm whales, orcas |
| slope | by its warmth | schools | *: squid, lanternfish rising at night |
| slope | by its warmth | bioluminescence | *: lanternfish lights |
| abyss | by its warmth | bioluminescence | *: the deep scattering layer rising at night |
| abyss | by its warmth | whales | *: sperm whales diving |
| trench | by its warmth | bioluminescence | *: hadal snailfish, unseen far below |

## Looks

| look | dark | middle | light |
|---|---|---|---|
| rainforest | `#0b2514` | `#2e6a2c` | `#93c04c` |
| dry forest | `#1d3417` | `#5a7a30` | `#b0bb62` |
| dry forest, dry | `#3a2a18` | `#8c6a3c` | `#cfae70` |
| tropical pines | `#13271c` | `#3d5c3a` | `#95a76c` |
| temperate forest | `#15301a` | `#4b7b35` | `#a9c96f` |
| temperate forest, fresh | `#28461f` | `#79a746` | `#d8e9a2` |
| temperate forest, turning | `#3b1c10` | `#b3482a` | `#e8b443` |
| temperate forest, bare | `#2b2522` | `#6d5e50` | `#aa9c8a` |
| conifer forest | `#0e2119` | `#2f4b37` | `#708b63` |
| taiga | `#0f2019` | `#35513b` | `#8c9b71` |
| taiga, turning | `#1a2618` | `#7a6a2a` | `#e0b840` |
| savanna | `#2b3b19` | `#7b8b39` | `#c9c171` |
| savanna, dry | `#4b3621` | `#a1814b` | `#e1c991` |
| grassland | `#2f3b1d` | `#7b8d43` | `#c9c981` |
| grassland, dry | `#3f3323` | `#8d7751` | `#d1bd8d` |
| wetland | `#10292a` | `#3b6b4b` | `#a9b971` |
| wetland, dry | `#2c2a1c` | `#7a7446` | `#c8b880` |
| montane | `#2b2b23` | `#6f6b4f` | `#b9b18d` |
| tundra | `#262a1a` | `#6a6b3c` | `#b9a971` |
| tundra, bare | `#34291f` | `#7b6751` | `#b9a589` |
| mediterranean | `#25311d` | `#6b7b45` | `#c1c18b` |
| mediterranean, dry | `#3b3121` | `#9b8553` | `#ddc991` |
| desert | `#6b4b2b` | `#c19161` | `#edd5a1` |
| desert, bloom | `#5b4a2b` | `#b1916b` | `#e9c9c1` |
| mangrove | `#0e251d` | `#2f5337` | `#7b8b53` |
| ice | `#6b7b91` | `#b9c9d9` | `#f3f7fb` |
| snow | `#7b8da1` | `#c9d5e1` | `#f7f9fb` |
| salt | `#8b8b83` | `#d1d1c9` | `#fbfbf5` |
| rock | `#3b2f29` | `#8b7563` | `#c9b59d` |
| lake | `#0b1b1f` | `#23454b` | `#5b8189` |
| sea, tropical shallows | `#0a3b4b` | `#1b8b9b` | `#7bd1c9` |
| sea, tropical | `#061b3b` | `#11417b` | `#3b79b1` |
| sea, subtropical | `#081d39` | `#194b7b` | `#4b87b1` |
| sea, temperate | `#0b1f2b` | `#2b4b5b` | `#6b8b97` |
| sea, polar | `#11212b` | `#3b5361` | `#8ba1ab` |
| sea, upwelling | `#0b2b2b` | `#2b6b5b` | `#7ba991` |

## How the atlas's conditions shape a place

- **where**: the plane is the Earth: a quarter-degree atlas cell is 233 cells of the plane, east is east, and the plane repeats the Earth every 360 degrees
- **edges**: where one place gives way to another, its edge wanders by up to 144 cells and is dithered across 13, as two sprayed colours meet
- **vegetation**: each stratum's cover is scaled by the place's canopy height over its biome's typical height, so farmland and cities thin the forest they stand in; grass and shrubs thin with aridity
- **season**: the month's mean temperature and rain set the phenology's phase; the month's snow cover whitens the ground by that share, in drifts
- **light**: the sun's noon elevation for the latitude and month sets how long shadows fall; where the sun does not rise, it is night, and above 60 degrees an aurora moves
- **relief**: the ground is shaded by the atlas's elevation, and roughened into ridges as far as its relief runs
- **clouds**: the month's cloud type sets the shapes, and its cloud amount how much of the sky they cover; their shadows fall on the ground
- **rain**: the month's rain (snowfall where the month's mean is below freezing) sets how hard it falls
- **view**: the view distance sets a veil of the sky's colour over the ground: the shorter the view, the thicker the veil
- **colour**: each place wears the saved paintings nearest its look (see LOOKS); nothing is painted in a colour the collection does not have
- **sea**: at sea the ground is water: its depth zone and warmth choose its look, swell runs with the wind, and marine life replaces the land's
