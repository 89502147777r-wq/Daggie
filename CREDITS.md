# Credits

## Car Concept (CAR mode, "Skyscraper vs Hammer")
- File: `car-concept.bin` (gzipped glTF binary)
- Source: [Car Concept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), KhronosGroup glTF-Sample-Assets
- Author: **Eric Chadwick**, © 2024 Darmstadt Graphics Group GmbH (based on a public domain model by Unity Fan)
- License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/legalcode)
- Changes made for the game: roof, rear glass, door glass, roll cage, pedals and floor mats removed (an open targa so the driver is visible);
  the Khronos and 3D Commerce logos (license plate, steering wheel emblem, tyre sidewall and logo textures) removed, since those are trademarks
  and not covered by CC BY; material variants removed (Carmine paint kept); wipers simplified; textures resized and converted to WebP;
  glass shown without the transmission pass. In the game the body dents, scrapes and loses parts.

## HDRI
- File: `venice_sunset_1k.hdr`: [Venice Sunset](https://polyhaven.com/a/venice_sunset) by Greg Zaal, [Poly Haven](https://polyhaven.com), CC0

## 3D models: the five lab cannons (`models/`)
From [Sketchfab](https://sketchfab.com), [Creative Commons Attribution](https://creativecommons.org/licenses/by/4.0/). Fetched by `tools/sketchfab_models.py` (GitHub Actions workflow "Sketchfab models").
Changes made for the game: repainted with game-style skins (Neon Rider, Desert Tiger, Arctic Digital, Red Dragon, Galaxy Fade) drawn over the original textures' shading; converted to glTF binary with WebP textures (max 1024 px); turned, scaled and placed in the lab; the barrel is widened so Daggie fits in it head first;
the recoilless rifle is painted olive (it came untextured); the bazooka stands on a tripod added in the game.
- `models/bazooka.glb` (level 1, bazooka): [WW2 US Bazooka](https://sketchfab.com/3d-models/ww2-us-bazooka-6b1d0c8c2f78483d8b398b8d923a8928) by **Tactical_Beard**, CC Attribution
- `models/recoilless.glb` (level 2, recoilless rifle): [SPG-9](https://sketchfab.com/3d-models/spg-9-6c31a440a65145e8814e9974eabf2227) by **Jack512kb**, CC Attribution
- `models/fieldgun.glb` (level 3, field gun): [75mm Field Gun](https://sketchfab.com/3d-models/75mm-field-gun-f717828c62264b66a2235f585b85d729) by **kisotsu**, CC Attribution
- `models/tank.glb` (level 4, tank): [Tank T-34](https://sketchfab.com/3d-models/tank-t-34-01af3ca4a7bf41ebbd5f1986edeb77fd) by **RomanGurd**, CC Attribution
- `models/spg.glb` (level 5, self-propelled howitzer): [PANZERHAUBITZE 2000 ARTILLERY (PzH-2000)](https://sketchfab.com/3d-models/panzerhaubitze-2000-artillery-pzh-2000-da078be6bc66461e87034f29600a4982) by **MirzaArrafiERV_45**, CC Attribution

### Crash mix vehicles and obstacles
Same source and licence. Changes made for the game: converted to glTF binary with WebP textures (max 1024 px); turned, scaled and placed to the size of each vehicle or obstacle;
cut into pieces that fly apart in a crash; the car and the truck crumple where they are hit, the car's glass cracks; the two barrels of one model are used as four kinds (red, green, blue, yellow); repainted: blue sofa, green wheelbarrow, red tricycle, red car, white truck cab, yellow-and-black post;
the truck's badge and name strip and the dumpster's lid are removed, the truck's windows and lamps are glass that cracks and breaks.
- `tex/brick_*.jpg` (above) is also used for the bricks of the crash mix brick wall.
- `models/v_cart.glb` (vehicle, shopping cart): [Shopping Trolley](https://sketchfab.com/3d-models/shopping-trolley-5770a906c5004041b65604126e71b620) by **mehran1500**, CC Attribution
- `models/v_tub.glb` (vehicle, bathtub): [Bathtub](https://sketchfab.com/3d-models/bathtub-3350f81025974c53808a2efd2b31d4fd) by **roughdominator**, CC Attribution
- `models/v_chair.glb` (vehicle, office chair): [Office Chair](https://sketchfab.com/3d-models/office-chair-b228a29fa84544c2be501c295653ffe7) by **nokillnando**, CC Attribution
- `models/v_sofa.glb` (vehicle, sofa): [Old Couch](https://sketchfab.com/3d-models/old-couch-443d9bb95e944afe8ebc4ff489e2886c) by **oisougabo**, CC Attribution
- `models/v_toilet.glb` (vehicle, toilet): [Toilet](https://sketchfab.com/3d-models/toilet-132a8ee2af3a40d39d270fbed3d3666c) by **hippostance**, CC Attribution
- `models/v_barrow.glb` (vehicle, wheelbarrow): [Wheelbarrow](https://sketchfab.com/3d-models/wheelbarrow-c0dcebcb0d4b47bd98df534334f4caf6) by **i.aleksey.yakovlev**, CC Attribution
- `models/v_trike.glb` (vehicle, tricycle): [Tricycle](https://sketchfab.com/3d-models/tricycle-d30c207f4c0246588f766b0dd49b459c) by **Marousiya**, CC Attribution
- `models/v_bin.glb` (vehicle, waste container): [LOW POLY - DUMPSTER](https://sketchfab.com/3d-models/low-poly-dumpster-093e5b05faa947729b1be24c013e563b) by **Colin.Greenall**, CC Attribution
- `models/o_truck.glb` (obstacle, dump truck): [Shacman F3000 Dump Truck](https://sketchfab.com/3d-models/shacman-f3000-dump-truck-010b0518d3f946b98e2ae3bddf52fbd8) by **benjamintang2012**, CC Attribution
- `models/o_car.glb` (obstacle, car): [Negotiator '80 - Low poly model](https://sketchfab.com/3d-models/negotiator-80-low-poly-model-892b2684fb37442299bfad9222cf331c) by **DanielZhabotinsky**, CC Attribution
- `models/o_tire.glb` (obstacle, tire stack): [Old Dirty Tire](https://sketchfab.com/3d-models/old-dirty-tire-ec06c0af626746e7a44de65436037173) by **tahircakir**, CC Attribution
- `models/o_barrel.glb` (obstacle, barrel wall): [Dirty oil barrel - 5MB](https://sketchfab.com/3d-models/dirty-oil-barrel-5mb-b973a95ff3bb478a941ccb06a70b14bb) by **ahmagh2e**, CC Attribution
- `models/o_barrier.glb` (obstacle, concrete barrier): [Jersey Barrier](https://sketchfab.com/3d-models/jersey-barrier-b52246c9611a42a99a03b425535a0237) by **emran.bayati**, CC Attribution
- `models/o_bollard.glb` (obstacle, steel post): [Street Bollard](https://sketchfab.com/3d-models/street-bollard-9b9db79ae21c4e118423efae658e7fb7) by **FameProductions**, CC Attribution
- `models/v_bumper.glb` (vehicle, bumper car (no pole, no floor plate)): [Bumper Car](https://sketchfab.com/3d-models/bumper-car-05e53156ee874c60ab14f5405bd9f086) by **koker06**, CC Attribution
- `models/v_wheelchair.glb` (vehicle, wheelchair): [Wheelchair](https://sketchfab.com/3d-models/wheelchair-54911b7d81a44991804c87c6fc58c4df) by **maxencerouillet**, CC Attribution
- `models/v_kart.glb` (vehicle, vintage kart): [Vintage Kart (CycleKart)](https://sketchfab.com/3d-models/vintage-kart-cyclekart-962316b91e914fc1808f6fb574b46ba5) by **Mike_hbrt**, CC Attribution
- `models/v_mower.glb` (vehicle, lawn tractor): [Lawn Tractor](https://sketchfab.com/3d-models/lawn-tractor-97ec916314324ed8a828176f3d310f82) by **mirrol**, CC Attribution
- `models/v_bed.glb` (vehicle, hospital bed): [Hospital Bed](https://sketchfab.com/3d-models/hospital-bed-f8c13a19e84343e7b644c19f7b9488d3) by **loxfear**, CC Attribution
- `models/o_hay.glb` (obstacle, hay bales): [Hay bale](https://sketchfab.com/3d-models/hay-bale-e01a6a0f9ed843279adfac2427c99679) by **NoodePoodle**, CC Attribution
- `models/o_booth.glb` (obstacle, phone booth): [London Phone Booth](https://sketchfab.com/3d-models/london-phone-booth-b9033372814b421a8fb225990c8f2226) by **stovepipe**, CC Attribution
- `models/o_bus.glb` (obstacle, school bus): [School Bus](https://sketchfab.com/3d-models/school-bus-a959ee8ce17d434f9fdbc93cad199a21) by **Macaroniii**, CC Attribution
- `models/o_vending.glb` (obstacle, vending machine): [Red Japanese Vending Machine](https://sketchfab.com/3d-models/red-japanese-vending-machine-a8a6874f62da478f8572554959d3c62e) by **tokyo45otaku**, CC Attribution
- `models/p_crate.glb` (obstacle, crate stack): [Wooden Crate 01](https://polyhaven.com/a/wooden_crate_01), Poly Haven, CC0

## PBR surfaces (HD look, `tex/`)
All from [Poly Haven](https://polyhaven.com), CC0. 1k JPG sets (diffuse, OpenGL normal, roughness), recompressed for the web.
- `tex/asphalt_*.jpg`: [Asphalt Pit Lane](https://polyhaven.com/a/asphalt_pit_lane) by Dimitrios Savva. Road and ramp, tiled every 3 m, diffuse lifted in the game.
- `tex/concrete_*.jpg`: [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) by Dario Barresi and Charlotte Baglioni. Skyscraper roof and parapets.
- `tex/metal_*.jpg`: [Metal Plate 02](https://polyhaven.com/a/metal_plate_02) by Rob Tuytel. Head of the giant hammer (diffuse desaturated and brightened to read as steel).
- `tex/ply_*.jpg`: [Plywood](https://polyhaven.com/a/plywood) by Rob Tuytel. Lab cannon: the plywood wall.
- `tex/oak_*.jpg`: [Brown Planks 03](https://polyhaven.com/a/brown_planks_03) by Rob Tuytel. Lab cannon: the oak wall (tinted warmer).
- `tex/brick_*.jpg`: [Red Brick 03](https://polyhaven.com/a/red_brick_03) by Rob Tuytel. Lab cannon: the brick wall.
- `tex/stone_*.jpg`: [Rustic Stone Wall 02](https://polyhaven.com/a/rustic_stone_wall_02) by Amal Kumar. Lab cannon: the stone wall.
- `tex/hay_*.jpg`: normal and roughness of [Thatch Roof Angled](https://polyhaven.com/a/thatch_roof_angled) by Rob Tuytel and Dimitrios Savva (512 px). Straw relief on the hay bale wall.
- `tex/frost_*.jpg`: normal and roughness of [Snow 02](https://polyhaven.com/a/snow_02) by Rob Tuytel (512 px). Frost on the ice and diamond walls, a slight unevenness on thick and armoured glass.
- `tex/conc_*.jpg`, `tex/steel_*.jpg`: greyscale copies of Concrete Wall 008 and Metal Plate 02 for the lab's concrete and steel walls;
  the Metal Plate 02 relief is also on the five lab cannons, the wall frames, the vault door and the gold wall.

## Sound effects (`sfx/`)
### From [Freesound](https://freesound.org) (CC0 and CC BY)
Every file is the sound's HQ preview, trimmed, faded, loudness-matched and saved as mono MP3. Chosen by hand from
`tools/freesound_picks.json` and fetched by `tools/freesound_sfx.py` (GitHub Actions workflow "Freesound sounds").
CC BY sounds: licence linked on each line; CC0 sounds are credited anyway.
Loops (roll, cart, road, drone, amb*) are made seamless and written twice; the game loops the middle.
- `sfx/cannon1.mp3`: [Cannon1.wav](https://freesound.org/people/Isaac200000/sounds/184650/) by **Isaac200000**, CC0
- `sfx/cannon2.mp3`: [Cannon shot](https://freesound.org/people/SamsterBirdies/sounds/467883/) by **SamsterBirdies**, CC0
- `sfx/cannon3.mp3`: [Tank fire Mixed.wav](https://freesound.org/people/GaryQ/sounds/127845/) by **GaryQ**, CC0
- `sfx/glass1.mp3`: [Glass Break](https://freesound.org/people/unfa/sounds/221528/) by **unfa**, CC0
- `sfx/glass2.mp3`: [Glass Smash.wav](https://freesound.org/people/chewiesmissus/sounds/244238/) by **chewiesmissus**, CC0
- `sfx/glass3.mp3`: [Glass Shattering and Falling](https://freesound.org/people/221Beimesche/sounds/336425/) by **221Beimesche**, CC0
- `sfx/window1.mp3`: [Glass Break](https://freesound.org/people/avrahamy/sounds/141563/) by **avrahamy**, CC0
- `sfx/window2.mp3`: [Window break.wav](https://freesound.org/people/5plus5equalspatata/sounds/648134/) by **5plus5equalspatata**, CC0
- `sfx/window3.mp3`: [window breaking](https://freesound.org/people/RangoAnimations/sounds/613879/) by **RangoAnimations**, CC0
- `sfx/wood1.mp3`: [Crate Break 1.wav](https://freesound.org/people/kevinkace/sounds/66777/) by **kevinkace**, CC0
- `sfx/wood2.mp3`: [Wood Break.wav](https://freesound.org/people/Deathscyp/sounds/443293/) by **Deathscyp**, CC0
- `sfx/wood3.mp3`: [Smash.ogg](https://freesound.org/people/egomassive/sounds/536777/) by **egomassive**, CC0
- `sfx/hay1.mp3`: [leaves dry straw brush put down slam.flac](https://freesound.org/people/kyles/sounds/454064/) by **kyles**, CC0
- `sfx/hay2.mp3`: [Box_Shatter2.wav](https://freesound.org/people/PkBiggums/sounds/678536/) by **PkBiggums**, CC0
- `sfx/hay3.mp3`: [Box Falling Down](https://freesound.org/people/danlucaz/sounds/500283/) by **danlucaz**, CC0
- `sfx/brick1.mp3`: [Bricks/Stones/Rocks/Gravel Falling](https://freesound.org/people/iwanPlays/sounds/567249/) by **iwanPlays**, CC0
- `sfx/brick2.mp3`: [BricksFalling_OWI.wav](https://freesound.org/people/JamesCato101/sounds/542330/) by **JamesCato101**, CC0
- `sfx/brick3.mp3`: [Brick Falling.mp3](https://freesound.org/people/LittleRainySeasons/sounds/418861/) by **LittleRainySeasons**, CC0
- `sfx/stone1.mp3`: [Concrete SMASH 2](https://freesound.org/people/magnuswaker/sounds/522099/) by **magnuswaker**, CC0
- `sfx/stone2.mp3`: [Rock destroy](https://freesound.org/people/Bertsz/sounds/524312/) by **Bertsz**, CC0
- `sfx/stone3.mp3`: [S020_Rock_Impact_Mono.wav](https://freesound.org/people/P%C3%B3l/sounds/385938/) by **Pól**, CC0
- `sfx/ice1.mp3`: [Breaking ice](https://freesound.org/people/Aurelon/sounds/422621/) by **Aurelon**, CC0
- `sfx/ice2.mp3`: [Breaking ice - medium 2](https://freesound.org/people/Aurelon/sounds/422625/) by **Aurelon**, CC0
- `sfx/ice3.mp3`: [ICEBrk_Break04_InMotionAudio_FREESampleSunday](https://freesound.org/people/InMotionAudio/sounds/719973/) by **InMotionAudio**, CC0
- `sfx/metal1.mp3`: [Anvil Hit 2](https://freesound.org/people/michorvath/sounds/270588/) by **michorvath**, CC0
- `sfx/metal2.mp3`: [HeavyRingingClang.mp3](https://freesound.org/people/wilhellboy/sounds/351370/) by **wilhellboy**, CC0
- `sfx/metal3.mp3`: [Metal Impact](https://freesound.org/people/Rickplayer/sounds/530486/) by **Rickplayer**, CC0
- `sfx/vault1.mp3`: [door metal big heavy close kinda slam thud echo offmic.wav](https://freesound.org/people/kyles/sounds/406197/) by **kyles**, CC0
- `sfx/vault2.mp3`: [Closing large metal door-001](https://freesound.org/people/AudioPapkin/sounds/814976/) by **AudioPapkin**, CC0
- `sfx/vault3.mp3`: [Metal Door Slam Heavy Reverb 4](https://freesound.org/people/Sheyvan/sounds/570001/) by **Sheyvan**, CC0
- `sfx/rip1.mp3`: [aluminum tearing on metal take one.wav](https://freesound.org/people/17nflores2/sounds/463857/) by **17nflores2**, CC0
- `sfx/rip2.mp3`: [SteveJMUK_CanTear1.wav](https://freesound.org/people/StevenJMUK/sounds/35279/) by **StevenJMUK**, CC0
- `sfx/rip3.mp3`: [BS_Scrape_12.wav](https://freesound.org/people/eardeer/sounds/337377/) by **eardeer**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/thud1.mp3`: [BODY FALL - V HVY - DIRT](https://freesound.org/people/leonelmail/sounds/504626/) by **leonelmail**, CC0
- `sfx/thud2.mp3`: [Body fall 1.wav](https://freesound.org/people/deleted_user_2104797/sounds/325270/) by **deleted_user_2104797**, CC0
- `sfx/thud3.mp3`: [Falling body hits the floor](https://freesound.org/people/courtneyeck/sounds/673424/) by **courtneyeck**, CC0
- `sfx/truck1.mp3`: [Big falling debris (crash)](https://freesound.org/people/xkeril/sounds/703247/) by **xkeril**, CC0
- `sfx/truck2.mp3`: [S38-24 Big heavy car crash.wav](https://freesound.org/people/craigsmith/sounds/675902/) by **craigsmith**, CC0
- `sfx/truck3.mp3`: [Loud Bang Crashing Metal Chunk Dropped in Metal Dumpster](https://freesound.org/people/qubodup/sounds/859154/) by **qubodup**, CC0
- `sfx/car1.mp3`: [Car Crash](https://freesound.org/people/squareal/sounds/237375/) by **squareal**, CC0
- `sfx/car2.mp3`: [Car Crash (with Glass)](https://freesound.org/people/magnuswaker/sounds/592388/) by **magnuswaker**, CC0
- `sfx/car3.mp3`: [Crash.wav](https://freesound.org/people/CogFireStudios/sounds/420356/) by **CogFireStudios**, CC0
- `sfx/tires1.mp3`: [Car Land/Hit](https://freesound.org/people/JustInvoke/sounds/446135/) by **JustInvoke**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/tires2.mp3`: [230104-013_normalized_tire_hit.wav](https://freesound.org/people/mmmtoop/sounds/674021/) by **mmmtoop**, CC0
- `sfx/tires3.mp3`: [Bike Drop Front Tire 2](https://freesound.org/people/Geoff-Bremner-Audio/sounds/730974/) by **Geoff-Bremner-Audio**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/sand1.mp3`: [sandfall5.wav](https://freesound.org/people/Wagna/sounds/326304/) by **Wagna**, CC0
- `sfx/sand2.mp3`: [Sand slidding out of shovel slowly.wav](https://freesound.org/people/XfiXy8/sounds/467301/) by **XfiXy8**, CC0
- `sfx/sand3.mp3`: [Gravel Pouring.wav](https://freesound.org/people/cartoonrob/sounds/588467/) by **cartoonrob**, CC0
- `sfx/body1.mp3`: [Big robot footstep](https://freesound.org/people/AudioPapkin/sounds/813056/) by **AudioPapkin**, CC0
- `sfx/body2.mp3`: [Combat Punch Metal Armor](https://freesound.org/people/EminYILDIRIM/sounds/545021/) by **EminYILDIRIM**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/body3.mp3`: [robot step short medium-heavy.wav](https://freesound.org/people/keemocore/sounds/148309/) by **keemocore**, CC BY ([http://creativecommons.org/licenses/by/3.0/](http://creativecommons.org/licenses/by/3.0/))
- `sfx/creak1.mp3`: [Metal creak.wav](https://freesound.org/people/sophiehall3535/sounds/245945/) by **sophiehall3535**, CC0
- `sfx/creak2.mp3`: [Metallic groan long.wav](https://freesound.org/people/Crinkem/sounds/481787/) by **Crinkem**, CC0
- `sfx/creak3.mp3`: [Metal Creak 2.wav](https://freesound.org/people/ingudios/sounds/119466/) by **ingudios**, CC0
- `sfx/hdboom1.mp3`: [Cinematic Impact](https://freesound.org/people/deleted_user_3277771/sounds/177242/) by **deleted_user_3277771**, CC0
- `sfx/hdboom2.mp3`: [Cinematic_Boom_Rhapsodize.wav](https://freesound.org/people/rhapsodize/sounds/255111/) by **rhapsodize**, CC0
- `sfx/hdboom3.mp3`: [Dramatic Hit](https://freesound.org/people/qubodup/sounds/222517/) by **qubodup**, CC0
- `sfx/hdwhoosh1.mp3`: [Whoosh Heavy Spear Hammer Large](https://freesound.org/people/EminYILDIRIM/sounds/540300/) by **EminYILDIRIM**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/hdwhoosh2.mp3`: [Very Big Whoosh](https://freesound.org/people/Paul368/sounds/237980/) by **Paul368**, CC0
- `sfx/hdwhoosh3.mp3`: [FX - Swoosh - Low Pitch](https://freesound.org/people/bolkmar/sounds/475135/) by **bolkmar**, CC0
- `sfx/uihit1.mp3`: [(SFX) Short Bassy Industrial Hit](https://freesound.org/people/waveplaySFX/sounds/402692/) by **waveplaySFX**, CC0
- `sfx/uihit2.mp3`: [Sound Design Elements Impact SFX PS 019](https://freesound.org/people/AudioPapkin/sounds/755056/) by **AudioPapkin**, CC0
- `sfx/uihit3.mp3`: [Stab reverb hit (minimal)](https://freesound.org/people/xkeril/sounds/736850/) by **xkeril**, CC0
- `sfx/uirise1.mp3`: [ENERGY RISER 2](https://freesound.org/people/magnuswaker/sounds/523057/) by **magnuswaker**, CC0
- `sfx/uirise2.mp3`: [quick woosh](https://freesound.org/people/florianreichelt/sounds/683101/) by **florianreichelt**, CC0
- `sfx/uirise3.mp3`: [Swishes_4_strong_fast.wav](https://freesound.org/people/videofueralle/sounds/614170/) by **videofueralle**, CC0
- `sfx/uitick1.mp3`: [Button Tick](https://freesound.org/people/NenadSimic/sounds/268108/) by **NenadSimic**, CC0
- `sfx/uitick2.mp3`: [Sci Fi Interface](https://freesound.org/people/Jofae/sounds/367997/) by **Jofae**, CC0
- `sfx/uitick3.mp3`: [Beep Space Button](https://freesound.org/people/GameAudio/sounds/220206/) by **GameAudio**, CC0
- `sfx/jump1.mp3`: [Woosh](https://freesound.org/people/florianreichelt/sounds/683096/) by **florianreichelt**, CC0
- `sfx/jump2.mp3`: [swoosh.wav](https://freesound.org/people/PorkMuncher/sounds/263595/) by **PorkMuncher**, CC0
- `sfx/jump3.mp3`: [swoosh](https://freesound.org/people/ImATaco/sounds/724527/) by **ImATaco**, CC0
- `sfx/land1.mp3`: [S019_Landing_Impact_Mono.wav](https://freesound.org/people/P%C3%B3l/sounds/385933/) by **Pól**, CC0
- `sfx/land2.mp3`: [Jumping on Car Hood](https://freesound.org/people/sanlega/sounds/467230/) by **sanlega**, CC0
- `sfx/land3.mp3`: [Car Land/Hit](https://freesound.org/people/JustInvoke/sounds/446135/) by **JustInvoke**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/win1.mp3`: [Cheer 1 short.wav](https://freesound.org/people/jayfrosting/sounds/333405/) by **jayfrosting**, CC0
- `sfx/win2.mp3`: [Short Crowd Cheer.flac](https://freesound.org/people/qubodup/sounds/182571/) by **qubodup**, CC0
- `sfx/win3.mp3`: [Medium crowd cheering 01](https://freesound.org/people/misjoc/sounds/400587/) by **misjoc**, CC0
- `sfx/roll1.mp3`: [Skateboard rolling down concrete ramp.wav](https://freesound.org/people/Bruno_Garcez/sounds/243765/) by **Bruno_Garcez**, CC0
- `sfx/roll2.mp3`: [skateboard.wav](https://freesound.org/people/prometheus888/sounds/507714/) by **prometheus888**, CC0
- `sfx/cart1.mp3`: [Shopping Cart 01.wav](https://freesound.org/people/Sonicorchestra/sounds/434885/) by **Sonicorchestra**, CC0
- `sfx/cart2.mp3`: [Noisy Rolling Metal Cart on Rubber Wheels](https://freesound.org/people/reconsider59/sounds/397994/) by **reconsider59**, CC0
- `sfx/road1.mp3`: [Car driving ambience](https://freesound.org/people/priesjensen/sounds/495795/) by **priesjensen**, CC0
- `sfx/road2.mp3`: [Car Driving Interior](https://freesound.org/people/squareal/sounds/237374/) by **squareal**, CC0
- `sfx/drone1.mp3`: [UAS Drone Hover 01.wav](https://freesound.org/people/DCPoke/sounds/387985/) by **DCPoke**, CC0
- `sfx/drone2.mp3`: [Drone Flying](https://freesound.org/people/Sheyvan/sounds/470127/) by **Sheyvan**, CC0
- `sfx/ambcity1.mp3`: [Ambience_Berlin_Rooftop.wav](https://freesound.org/people/danner/sounds/426894/) by **danner**, CC0
- `sfx/ambcity2.mp3`: [Rooftop city heihbourhood afternoon, distant traffic, residents activity, distant muzein prayer.wav](https://freesound.org/people/risto_alcinov/sounds/371260/) by **risto_alcinov**, CC0
- `sfx/ambsky1.mp3`: [wind_synth_high_altitude.wav](https://freesound.org/people/android_lime/sounds/570890/) by **android_lime**, CC0
- `sfx/ambsky2.mp3`: [Winter wind.wav](https://freesound.org/people/Elanor1995/sounds/688841/) by **Elanor1995**, CC0
- `sfx/amblab1.mp3`: [Roomtone Warehouse Fans Vents Large](https://freesound.org/people/leonelmail/sounds/427861/) by **leonelmail**, CC0
- `sfx/amblab2.mp3`: [Factory_Ambiance.wav (48khz/24bit)](https://freesound.org/people/neilraouf/sounds/431480/) by **neilraouf**, CC0
- `sfx/bazooka1.mp3`: [Huge rocket launcher.wav](https://freesound.org/people/CGEffex/sounds/100772/) by **CGEffex**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/bazooka2.mp3`: [S19-34 Bazooka shot.wav](https://freesound.org/people/craigsmith/sounds/675581/) by **craigsmith**, CC0
- `sfx/bazooka3.mp3`: [Rocket launcher fire](https://freesound.org/people/ValhallaProject/sounds/761514/) by **ValhallaProject**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/fieldgun1.mp3`: [CivilWarCannonFire_01.WAV](https://freesound.org/people/daveincamas/sounds/368270/) by **daveincamas**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/fieldgun2.mp3`: [CW_Cannon_Single1.wav](https://freesound.org/people/richardemoore/sounds/162626/) by **richardemoore**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/fieldgun3.mp3`: [Cannon explosion sound](https://freesound.org/people/SamsterBirdies/sounds/621000/) by **SamsterBirdies**, CC0
- `sfx/tankgun1.mp3`: [Tank fire Mixed.wav](https://freesound.org/people/GaryQ/sounds/127845/) by **GaryQ**, CC0
- `sfx/tankgun2.mp3`: [xm360_canon_shot_1.flac](https://freesound.org/people/qubodup/sounds/67524/) by **qubodup**, CC0
- `sfx/tankgun3.mp3`: [m1a1_abrams_canon_shot_1.flac](https://freesound.org/people/qubodup/sounds/67519/) by **qubodup**, CC0
- `sfx/howitzer1.mp3`: [Artillery Gunfire](https://freesound.org/people/qubodup/sounds/239137/) by **qubodup**, CC0
- `sfx/howitzer2.mp3`: [ArtilleryTankFireSynthetic3.wav](https://freesound.org/people/zimbot/sounds/117801/) by **zimbot**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/howitzer3.mp3`: [Howitzer Artillery Gun Shot Sound Effect 03](https://freesound.org/people/qubodup/sounds/161341/) by **qubodup**, CC0
- `sfx/recoil1.mp3`: [BGM 71 TOW Missile Launch 1 (less echo)](https://freesound.org/people/qubodup/sounds/67542/) by **qubodup**, CC0
- `sfx/recoil2.mp3`: [C4 Rocket Launch (M1 Assault Breacher Vehicle)](https://freesound.org/people/qubodup/sounds/159610/) by **qubodup**, CC0
- `sfx/recoil3.mp3`: [AGM-114 Hellfire Rocket Missile Launch.flac](https://freesound.org/people/qubodup/sounds/162368/) by **qubodup**, CC0
- `sfx/w_conc1.mp3`: [Sledgehammer - using to break a block of concrete.](https://freesound.org/people/SoundsnapFX/sounds/583964/) by **SoundsnapFX**, CC BY ([http://creativecommons.org/licenses/by/3.0/](http://creativecommons.org/licenses/by/3.0/))
- `sfx/w_conc2.mp3`: [PieceofConcrete01.wav](https://freesound.org/people/kingsrow/sounds/194688/) by **kingsrow**, CC0
- `sfx/w_conc3.mp3`: [PieceofConcrete02.wav](https://freesound.org/people/kingsrow/sounds/194687/) by **kingsrow**, CC0
- `sfx/w_armor1.mp3`: [Hard Glass Impact](https://freesound.org/people/deleted_user_3656686/sounds/418194/) by **deleted_user_3656686**, CC0
- `sfx/w_armor2.mp3`: [Breaking Glass 2.mp3](https://freesound.org/people/FunWithSound/sounds/390721/) by **FunWithSound**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_armor3.mp3`: [Breaking Glass 25.mp3](https://freesound.org/people/FunWithSound/sounds/390723/) by **FunWithSound**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_crystal1.mp3`: [Shattering Chandelier.mp3](https://freesound.org/people/matt_ratz/sounds/541601/) by **matt_ratz**, CC0
- `sfx/w_crystal2.mp3`: [Vidrios_Rotos.wav](https://freesound.org/people/Thingy17/sounds/470898/) by **Thingy17**, CC BY ([http://creativecommons.org/licenses/by/3.0/](http://creativecommons.org/licenses/by/3.0/))
- `sfx/w_crystal3.mp3`: [Breaking Glass 3](https://freesound.org/people/AleXZavesa/sounds/853697/) by **AleXZavesa**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_gold1.mp3`: [Metallic Slam (Anvil)](https://freesound.org/people/OOF9/sounds/841804/) by **OOF9**, CC0
- `sfx/w_gold2.mp3`: [Iron Hits.wav](https://freesound.org/people/Mrthenoronha/sounds/371353/) by **Mrthenoronha**, CC0
- `sfx/w_gold3.mp3`: [long-metal-hit-02.wav](https://freesound.org/people/newagesoup/sounds/337831/) by **newagesoup**, CC0
- `sfx/w_steel1.mp3`: [Big stereo metal hit](https://freesound.org/people/LPA134/sounds/329515/) by **LPA134**, CC0
- `sfx/w_steel2.mp3`: [Steel_Sheet_Bang.wav](https://freesound.org/people/mickyman5000/sounds/340492/) by **mickyman5000**, CC0
- `sfx/w_steel3.mp3`: [Steel_Sheet_Hitting.wav](https://freesound.org/people/mickyman5000/sounds/340494/) by **mickyman5000**, CC0
- `sfx/w_ply1.mp3`: [JBF Plywood Breaking 2.aif](https://freesound.org/people/cmusounddesign/sounds/96167/) by **cmusounddesign**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_ply2.mp3`: [JBF Plywood Breaking 1.aif](https://freesound.org/people/cmusounddesign/sounds/96166/) by **cmusounddesign**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_ply3.mp3`: [wooden plank snap.wav](https://freesound.org/people/Tomlija/sounds/98056/) by **Tomlija**, CC BY ([http://creativecommons.org/licenses/by/3.0/](http://creativecommons.org/licenses/by/3.0/))
- `sfx/w_oak1.mp3`: [Boards Fall 4](https://freesound.org/people/AleXZavesa/sounds/853904/) by **AleXZavesa**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_oak2.mp3`: [Boards Fall 1](https://freesound.org/people/AleXZavesa/sounds/853901/) by **AleXZavesa**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_oak3.mp3`: [Smash.ogg](https://freesound.org/people/egomassive/sounds/536777/) by **egomassive**, CC0
- `sfx/w_hay1.mp3`: [Dry Grass Crunch.wav](https://freesound.org/people/worthahep88/sounds/319206/) by **worthahep88**, CC0
- `sfx/w_hay2.mp3`: [Bush sound effect](https://freesound.org/people/darceyprodanovic/sounds/833454/) by **darceyprodanovic**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_thick1.mp3`: [A glass door shatters and breaks](https://freesound.org/people/justiningo/sounds/437623/) by **justiningo**, CC BY ([https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/))
- `sfx/w_thick2.mp3`: [Slow Motion Glass Shatter](https://freesound.org/people/bevibeldesign/sounds/349905/) by **bevibeldesign**, CC0
- `sfx/w_thick3.mp3`: [Glass.ogg](https://freesound.org/people/egomassive/sounds/536763/) by **egomassive**, CC0

### From [OpenGameArt](https://opengameart.org) (CC0)
- `sfx/hdwind1.mp3`: [Wind](https://opengameart.org/content/wind) by **IgnasD**, made into a seamless loop
- `sfx/hdengine1.mp3`, `sfx/hdengine2.mp3`: [racing car engine sound loops](https://opengameart.org/content/racing-car-engine-sound-loops) by **domasx2**
- `sfx/hdcity_ir.mp3` (the city reverb): the echo tail of two outdoor firework bangs from
  [25 CC0 bang / firework SFX](https://opengameart.org/content/25-cc0-bang-firework-sfx) by **rubberduck**, with the bang itself removed
- Debris and shard sounds by **rubberduck** (CC0), trimmed and levelled:
  - `sfx/d_glass1-3.mp3`, `sfx/d_rock1-3.mp3`, `sfx/d_metal1-2.mp3`, `sfx/d_wood3.mp3`, `sfx/f_glass1-2.mp3`, `sfx/f_rock1-2.mp3`, `sfx/f_wood1-2.mp3`, `sfx/f_metal1-2.mp3`:
    [75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx)
  - `sfx/d_wood1-2.mp3`, `sfx/d_metal3.mp3`: [100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx)
  - `sfx/d_soft1-2.mp3`: [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx)

### Daggie
- `daggie_model.bin`, `daggie_tex.jpg`, `daggie_nor.jpg`, `daggie_mr.jpg`: the robot crash-test dummy, generated by the project author with Image to 3D AI (image-to-3d.ai) from their own concept art; cut into 15 body parts for the game's physics, textures resized to 2048 / 1024 px. The source file is attached to the `robot-model` release.

### Places of the crash mix (Poly Haven, CC0)
- Panoramas (`env/bg_*.jpg` background, `env/*_1k.hdr` light and reflections): [Hangar Interior](https://polyhaven.com/a/hangar_interior) (lab), [Goegap](https://polyhaven.com/a/goegap) (desert), [Snowy Field](https://polyhaven.com/a/snowy_field) (snow), [Shanghai Bund](https://polyhaven.com/a/shanghai_bund) (night city, turned so the skyline is at the end of the street), [Quarry 01](https://polyhaven.com/a/quarry_01) (quarry). Backgrounds resized to 4096 px.
- Ground scans (`tex/g_*`, 1k): [Aerial Beach 01](https://polyhaven.com/a/aerial_beach_01), [Snow 02](https://polyhaven.com/a/snow_02), [Dry Ground Rocks](https://polyhaven.com/a/dry_ground_rocks), [Asphalt 02](https://polyhaven.com/a/asphalt_02), [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001).
- Props (`models/p_*.glb`, simplified, WebP textures): [Namaqualand Boulder 02](https://polyhaven.com/a/namaqualand_boulder_02), [03](https://polyhaven.com/a/namaqualand_boulder_03), [05](https://polyhaven.com/a/namaqualand_boulder_05), [Rock 07](https://polyhaven.com/a/rock_07), [Rock 09](https://polyhaven.com/a/rock_09), [Dead Quiver Trunk](https://polyhaven.com/a/dead_quiver_trunk), [Dry Branches Medium 01](https://polyhaven.com/a/dry_branches_medium_01).

### Places of the crash mix (Sketchfab, CC BY)
- `models/s_spruce.glb` (snow, spruce): [Spruce tree](https://sketchfab.com/3d-models/spruce-tree-7a5db417827244d98827459bce0cc944) by **intice184**, CC Attribution
- `models/s_fir.glb` (snow, fir): [Fir tree](https://sketchfab.com/3d-models/fir-tree-0965de5def1342cd8b8b1a0fa5643e27) by **intice184**, CC Attribution
- `models/s_dozer.glb` (quarry, bulldozer): [Bulldozer Photogrammetry](https://sketchfab.com/3d-models/bulldozer-photogrammetry-baa53594134f4a4f99d96ce4ba25492e) by **bertanbaday**, CC Attribution
- `models/s_saguaro1.glb` (desert, saguaro): [Realistic HD Saguaro cactus (27/30)](https://sketchfab.com/3d-models/realistic-hd-saguaro-cactus-2730-124202937a8c45e091f3af365446a087) by **PlantCatalog**, CC Attribution
- `models/s_saguaro2.glb` (desert, saguaro): [Realistic HD Saguaro cactus (16/30)](https://sketchfab.com/3d-models/realistic-hd-saguaro-cactus-1630-5b3c008df0bb4410b1596b5483605a8b) by **PlantCatalog**, CC Attribution
- `models/s_shed.glb` (desert, shack): [Worn Shed PBR Game-Ready](https://sketchfab.com/3d-models/worn-shed-pbr-game-ready-be6edd62e55a4f9a99da940fc164a5b9) by **donnichols**, CC Attribution
- `models/s_wtower.glb` (desert, water tower): [Water Tower](https://sketchfab.com/3d-models/water-tower-4e98f8c8fe4e4e9fae250a026974fe99) by **ahmagh2e**, CC Attribution
- `models/s_rustcar.glb` (desert, abandoned car): [Abandoned Car - BMW E30 Sedan](https://sketchfab.com/3d-models/abandoned-car-bmw-e30-sedan-32498418a32d43a78d0847ce4c55fcb0) by **roh3d**, CC Attribution
- `models/s_hut.glb` (snow, log hut): [Snowy Wooden Hut](https://sketchfab.com/3d-models/snowy-wooden-hut-857c02ab61834df8a8d125ccce6fec2a) by **gecko0307**, CC Attribution
- `models/s_snowman.glb` (snow, snowman): [Snowman](https://sketchfab.com/3d-models/snowman-7d683ce4a9c54f158cc73d65a16a9a29) by **alixor22**, CC Attribution
- `models/s_container.glb` (quarry, shipping container): [Freight shipping container - Rusted](https://sketchfab.com/3d-models/freight-shipping-container-rusted-2b787d1a02174d0bbca9eac34eb3a486) by **sousinho**, CC Attribution
- `models/s_excav.glb` (quarry, excavator): [Excavator](https://sketchfab.com/3d-models/excavator-84cd8adb9d104010b10f3fa89e5f6a70) by **rhymone**, CC Attribution
- The parked cars of the night city reuse `models/o_car.glb` (above), repainted.
