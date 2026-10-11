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
Changes made for the game: converted to glTF binary with WebP textures (max 1024 px); turned, scaled and placed in the lab; the barrel is widened so Daggie fits in it head first;
the recoilless rifle is painted olive (it came untextured); the bazooka stands on a tripod added in the game.
- `models/bazooka.glb` (level 1, bazooka): [WW2 US Bazooka](https://sketchfab.com/3d-models/ww2-us-bazooka-6b1d0c8c2f78483d8b398b8d923a8928) by **Tactical_Beard**, CC Attribution
- `models/recoilless.glb` (level 2, recoilless rifle): [SPG-9](https://sketchfab.com/3d-models/spg-9-6c31a440a65145e8814e9974eabf2227) by **Jack512kb**, CC Attribution
- `models/fieldgun.glb` (level 3, field gun): [75mm Field Gun](https://sketchfab.com/3d-models/75mm-field-gun-f717828c62264b66a2235f585b85d729) by **kisotsu**, CC Attribution
- `models/tank.glb` (level 4, tank): [Tank T-34](https://sketchfab.com/3d-models/tank-t-34-01af3ca4a7bf41ebbd5f1986edeb77fd) by **RomanGurd**, CC Attribution
- `models/spg.glb` (level 5, self-propelled howitzer): [PANZERHAUBITZE 2000 ARTILLERY (PzH-2000)](https://sketchfab.com/3d-models/panzerhaubitze-2000-artillery-pzh-2000-da078be6bc66461e87034f29600a4982) by **MirzaArrafiERV_45**, CC Attribution

## PBR surfaces (HD look, `tex/`)
All from [Poly Haven](https://polyhaven.com), CC0. 1k JPG sets (diffuse, OpenGL normal, roughness), recompressed for the web.
- `tex/asphalt_*.jpg`: [Asphalt Pit Lane](https://polyhaven.com/a/asphalt_pit_lane) by Dimitrios Savva. Road and ramp, tiled every 3 m, diffuse lifted in the game.
- `tex/concrete_*.jpg`: [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) by Dario Barresi and Charlotte Baglioni. Skyscraper roof and parapets.
- `tex/metal_*.jpg`: [Metal Plate 02](https://polyhaven.com/a/metal_plate_02) by Rob Tuytel. Head of the giant hammer (diffuse desaturated and brightened to read as steel).
- `tex/ply_*.jpg`: [Plywood](https://polyhaven.com/a/plywood) by Rob Tuytel. Lab cannon: the plywood wall.
- `tex/oak_*.jpg`: [Brown Planks 03](https://polyhaven.com/a/brown_planks_03) by Rob Tuytel. Lab cannon: the oak wall (tinted warmer).
- `tex/brick_*.jpg`: [Red Brick 03](https://polyhaven.com/a/red_brick_03) by Rob Tuytel. Lab cannon: the brick wall.
- `tex/stone_*.jpg`: [Rustic Stone Wall 02](https://polyhaven.com/a/rustic_stone_wall_02) by Amal Kumar. Lab cannon: the stone wall.
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

### From [OpenGameArt](https://opengameart.org) (CC0)
- `sfx/hdwind1.mp3`: [Wind](https://opengameart.org/content/wind) by **IgnasD**, made into a seamless loop
- `sfx/hdengine1.mp3`, `sfx/hdengine2.mp3`: [racing car engine sound loops](https://opengameart.org/content/racing-car-engine-sound-loops) by **domasx2**
- `sfx/hdcity_ir.mp3` (the city reverb): the echo tail of two outdoor firework bangs from
  [25 CC0 bang / firework SFX](https://opengameart.org/content/25-cc0-bang-firework-sfx) by **rubberduck**, with the bang itself removed
