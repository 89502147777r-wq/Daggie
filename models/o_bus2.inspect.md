
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                                        |
| ---                | ---                                          |
| version            | 2.0                                          |
| generator          | glTF-Transform v4.5.1                        |
| extensionsUsed     | EXT_texture_webp, KHR_materials_transmission |
| extensionsRequired | EXT_texture_webp                             |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName        | bboxMin                        | bboxMax                    | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---             | ---                            | ---                        | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Sketchfab_model | -64.33047, -1.45553, -15.79991 | 66.43567, 30.902, 16.06225 | 166,581            | 72,469            | 72,469                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                               | instances | size¹     |
| --- | ---       | ---       | ---            | ---          | ---      | ---     | ---                                      | ---       | ---       |
| 0   | Object_0  | TRIANGLES | 1              | 14           | 16       | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 596 Bytes |
| 1   | Object_1  | TRIANGLES | 1              | 16           | 17       | u16     | NORMAL:f32, POSITION:f32                 | 1         | 504 Bytes |
| 2   | Object_2  | TRIANGLES | 1              | 8            | 10       | u16     | NORMAL:f32, POSITION:f32                 | 1         | 288 Bytes |
| 3   | Object_3  | TRIANGLES | 1              | 16           | 17       | u16     | NORMAL:f32, POSITION:f32                 | 1         | 504 Bytes |
| 4   | Object_4  | TRIANGLES | 1              | 477          | 613      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 17.57 KB  |
| 5   | Object_5  | TRIANGLES | 1              | 704          | 912      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 26.11 KB  |
| 6   | Object_6  | TRIANGLES | 1              | 1,130        | 1,980    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 54.3 KB   |
| 7   | Object_7  | TRIANGLES | 1              | 1,744        | 2,039    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 59.4 KB   |
| 8   | Object_8  | TRIANGLES | 1              | 6,504        | 9,312    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 337.01 KB |
| 9   | Object_9  | TRIANGLES | 1              | 6,504        | 9,312    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 337.01 KB |
| 10  | Object_10 | TRIANGLES | 1              | 4,960        | 7,765    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 278.24 KB |
| 11  | Object_11 | TRIANGLES | 1              | 5,200        | 8,239    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 294.85 KB |
| 12  | Object_12 | TRIANGLES | 1              | 4,736        | 7,636    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 272.77 KB |
| 13  | Object_13 | TRIANGLES | 1              | 6,928        | 9,598    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 348.7 KB  |
| 14  | Object_14 | TRIANGLES | 1              | 367          | 398      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 11.75 KB  |
| 15  | Object_15 | TRIANGLES | 1              | 120          | 162      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 4.61 KB   |
| 16  | Object_16 | TRIANGLES | 1              | 62           | 44       | u16     | NORMAL:f32, POSITION:f32                 | 1         | 1.43 KB   |
| 17  | Object_17 | TRIANGLES | 1              | 124          | 216      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 5.93 KB   |
| 18  | Object_18 | TRIANGLES | 1              | 36           | 72       | u16     | NORMAL:f32, POSITION:f32                 | 1         | 1.94 KB   |
| 19  | Object_19 | TRIANGLES | 1              | 960          | 780      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 24.48 KB  |
| 20  | Object_20 | TRIANGLES | 1              | 1,661        | 1,831    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 53.91 KB  |
| 21  | Object_21 | TRIANGLES | 1              | 1,892        | 2,029    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 60.05 KB  |
| 22  | Object_22 | TRIANGLES | 1              | 4,508        | 2,620    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 89.93 KB  |
| 23  | Object_23 | TRIANGLES | 1              | 2,589        | 2,678    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 79.81 KB  |
| 24  | Object_24 | TRIANGLES | 1              | 864          | 1,056    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 30.53 KB  |
| 25  | Object_25 | TRIANGLES | 1              | 1,267        | 1,028    | u16     | NORMAL:f32, POSITION:f32                 | 1         | 32.27 KB  |
| 26  | Object_26 | TRIANGLES | 1              | 58           | 72       | u16     | NORMAL:f32, POSITION:f32                 | 1         | 2.08 KB   |
| 27  | Object_27 | TRIANGLES | 1              | 172          | 178      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 5.3 KB    |
| 28  | Object_28 | TRIANGLES | 1              | 384          | 288      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 9.22 KB   |
| 29  | Object_29 | TRIANGLES | 1              | 132          | 240      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 6.55 KB   |
| 30  | Object_30 | TRIANGLES | 1              | 356          | 281      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 8.88 KB   |
| 31  | Object_31 | TRIANGLES | 1              | 200          | 218      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 6.43 KB   |
| 32  | Object_32 | TRIANGLES | 1              | 316          | 239      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 7.63 KB   |
| 33  | Object_33 | TRIANGLES | 1              | 518          | 573      | u16     | NORMAL:f32, POSITION:f32                 | 1         | 16.86 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name          | instances | textures         | alphaMode | doubleSided |
| --- | ---           | ---       | ---              | ---       | ---         |
| 0   | 1616862037160 | 1         | baseColorTexture | MASK      | ✓           |
| 1   | black         | 2         |                  | OPAQUE    | ✓           |
| 2   | chrome        | 2         |                  | OPAQUE    | ✓           |
| 3   | material      | 2         | baseColorTexture | OPAQUE    | ✓           |
| 4   | material_4    | 4         | baseColorTexture | OPAQUE    | ✓           |
| 5   | glass         | 2         |                  | BLEND     | ✓           |
| 6   | light         | 1         |                  | OPAQUE    | ✓           |
| 7   | material_7    | 2         |                  | OPAQUE    | ✓           |
| 8   | metall        | 2         |                  | OPAQUE    | ✓           |
| 9   | rezina        | 2         |                  | OPAQUE    | ✓           |
| 10  | seat          | 1         |                  | OPAQUE    | ✓           |
| 11  | standard      | 2         |                  | OPAQUE    | ✓           |
| 12  | standard1     | 2         |                  | OPAQUE    | ✓           |
| 13  | standard11    | 2         |                  | OPAQUE    | ✓           |
| 14  | standard111   | 1         |                  | OPAQUE    | ✓           |
| 15  | standard1111  | 1         |                  | OPAQUE    | ✓           |
| 16  | standard11111 | 2         |                  | OPAQUE    | ✓           |
| 17  | standard2     | 1         |                  | OPAQUE    | ✓           |
| 18  | standard21    | 1         |                  | OPAQUE    | ✓           |
| 19  | wood          | 1         |                  | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size     | gpuSize⁵  |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---      | ---       |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x128   | 12.09 KB | 699.07 KB |
| 1   |      |     | baseColorTexture | 2         | image/webp |             | 1024x1024  | 75.04 KB | 5.59 MB   |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

