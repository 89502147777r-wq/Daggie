
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                 |
| ---                | ---                   |
| version            | 2.0                   |
| generator          | glTF-Transform v4.5.1 |
| extensionsUsed     | EXT_texture_webp      |
| extensionsRequired | EXT_texture_webp      |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName                         | bboxMin           | bboxMax             | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                              | ---               | ---                 | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | antenna_long__PzH_2000Gear_442_0 | -1.818, 0, -5.649 | 1.819, 6.343, 5.649 | 159,930            | 57,479            | 57,479                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                                              | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                               | instances | size¹     |
| --- | ---                                               | ---       | ---            | ---          | ---      | ---     | ---                                      | ---       | ---       |
| 0   | antenna_long__PzH_2000Gear_442_0                  | TRIANGLES | 1              | 1,064        | 1,002    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 38.45 KB  |
| 1   | g_cannonbase_pzh2000_l52mk2__PzH_2000Cannon_499_0 | TRIANGLES | 1              | 2,420        | 2,172    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 84.02 KB  |
| 2   | suspension_left__PzH_2000Wheels_704_0             | TRIANGLES | 1              | 14,000       | 14,396   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 544.67 KB |
| 3   | g_turret_pzh2000__PzH_2000Turret_774_0            | TRIANGLES | 1              | 9,049        | 10,657   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 395.32 KB |
| 4   | tread_left__PzH_2000Tracks_873_0                  | TRIANGLES | 1              | 3,264        | 3,174    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 121.15 KB |
| 5   | hull__PzH_2000Hull_252_0                          | TRIANGLES | 1              | 23,513       | 26,078   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 975.57 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name               | instances | textures         | alphaMode | doubleSided |
| --- | ---                | ---       | ---              | ---       | ---         |
| 0   | PzH_2000Gear_442   | 1         | baseColorTexture | OPAQUE    | ✓           |
| 1   | PzH_2000Cannon_499 | 1         | baseColorTexture | OPAQUE    | ✓           |
| 2   | PzH_2000Wheels_704 | 1         | baseColorTexture | OPAQUE    | ✓           |
| 3   | PzH_2000Turret_774 | 1         | baseColorTexture | OPAQUE    | ✓           |
| 4   | PzH_2000Tracks_873 | 1         | baseColorTexture | MASK      | ✓           |
| 5   | PzH_2000Hull_252   | 1         | baseColorTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size     | gpuSize⁵ |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---      | ---      |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x512   | 25.23 KB | 2.8 MB   |
| 1   |      |     | baseColorTexture | 1         | image/webp |             | 1024x512   | 23.72 KB | 2.8 MB   |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 67.75 KB | 5.59 MB  |
| 3   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 67.25 KB | 5.59 MB  |
| 4   |      |     | baseColorTexture | 1         | image/webp |             | 512x1024   | 28.55 KB | 2.8 MB   |
| 5   |      |     | baseColorTexture | 1         | image/webp |             | 1024x512   | 38.54 KB | 2.8 MB   |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

