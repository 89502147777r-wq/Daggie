
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
| #   | name            | rootName        | bboxMin                    | bboxMax                 | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---             | ---                        | ---                     | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Sketchfab_model | -0.621, -0.70978, -1.87933 | 0.621, 0.69484, 1.72275 | 69,612             | 19,847            | 19,847                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---       | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Object_0  | TRIANGLES | 1              | 3,847        | 4,706    | u16     | NORMAL:f32, POSITION:f32                              | 1         | 136.03 KB |
| 1   | Object_1  | TRIANGLES | 1              | 422          | 500      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 14.53 KB  |
| 2   | Object_2  | TRIANGLES | 1              | 472          | 728      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 20.3 KB   |
| 3   | Object_3  | TRIANGLES | 1              | 88           | 120      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 3.41 KB   |
| 4   | Object_4  | TRIANGLES | 1              | 556          | 840      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 23.5 KB   |
| 5   | Object_5  | TRIANGLES | 1              | 496          | 612      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 17.66 KB  |
| 6   | Object_6  | TRIANGLES | 1              | 304          | 436      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 12.29 KB  |
| 7   | Object_7  | TRIANGLES | 1              | 392          | 623      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 17.3 KB   |
| 8   | Object_8  | TRIANGLES | 1              | 4,268        | 5,732    | u16     | NORMAL:f32, POSITION:f32                              | 1         | 163.18 KB |
| 9   | Object_9  | TRIANGLES | 1              | 1,664        | 1,994    | u16     | NORMAL:f32, POSITION:f32                              | 1         | 57.84 KB  |
| 10  | Object_10 | TRIANGLES | 1              | 208          | 248      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 7.2 KB    |
| 11  | Object_11 | TRIANGLES | 1              | 105          | 139      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 3.97 KB   |
| 12  | Object_12 | TRIANGLES | 1              | 88           | 124      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 3.5 KB    |
| 13  | Object_13 | TRIANGLES | 1              | 344          | 396      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 11.57 KB  |
| 14  | Object_14 | TRIANGLES | 1              | 20           | 32       | u16     | NORMAL:f32, POSITION:f32                              | 1         | 888 Bytes |
| 15  | Object_15 | TRIANGLES | 1              | 4            | 8        | u16     | NORMAL:f32, POSITION:f32                              | 1         | 216 Bytes |
| 16  | Object_16 | TRIANGLES | 1              | 50           | 60       | u16     | NORMAL:f32, POSITION:f32                              | 1         | 1.74 KB   |
| 17  | Object_17 | TRIANGLES | 1              | 180          | 155      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 5         | 8.52 KB   |
| 18  | Object_18 | TRIANGLES | 1              | 456          | 600      | u16     | NORMAL:f32, POSITION:f32                              | 5         | 17.14 KB  |
| 19  | Object_19 | TRIANGLES | 1              | 36           | 60       | u16     | NORMAL:f32, POSITION:f32                              | 5         | 1.66 KB   |
| 20  | Object_20 | TRIANGLES | 1              | 300          | 270      | u16     | NORMAL:f32, POSITION:f32                              | 5         | 8.28 KB   |
| 21  | Object_29 | TRIANGLES | 1              | 180          | 155      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 8.52 KB   |
| 22  | Object_30 | TRIANGLES | 1              | 456          | 600      | u16     | NORMAL:f32, POSITION:f32                              | 5         | 17.14 KB  |
| 23  | Object_31 | TRIANGLES | 1              | 36           | 60       | u16     | NORMAL:f32, POSITION:f32                              | 5         | 1.66 KB   |
| 24  | Object_32 | TRIANGLES | 1              | 300          | 270      | u16     | NORMAL:f32, POSITION:f32                              | 5         | 8.28 KB   |
| 25  | Object_33 | TRIANGLES | 1              | 180          | 155      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 4         | 8.52 KB   |
| 26  | Object_41 | TRIANGLES | 1              | 156          | 224      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 6.31 KB   |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name           | instances | textures                        | alphaMode | doubleSided |
| --- | ---            | ---       | ---                             | ---       | ---         |
| 0   | main.003       | 2         |                                 | OPAQUE    | ✓           |
| 1   | Material.133   | 1         |                                 | OPAQUE    | ✓           |
| 2   | Material.116   | 3         |                                 | OPAQUE    | ✓           |
| 3   | Material.104   | 1         |                                 | OPAQUE    | ✓           |
| 4   | Material.102   | 1         |                                 | OPAQUE    | ✓           |
| 5   | bak.002        | 1         |                                 | OPAQUE    | ✓           |
| 6   | Material.101   | 1         |                                 | OPAQUE    | ✓           |
| 7   | icon.001       | 1         |                                 | OPAQUE    | ✓           |
| 8   | hamm_black.003 | 1         |                                 | OPAQUE    | ✓           |
| 9   | Material.132   | 1         |                                 | OPAQUE    | ✓           |
| 10  | Material.131   | 1         |                                 | OPAQUE    | ✓           |
| 11  | Material.130   | 1         |                                 | OPAQUE    | ✓           |
| 12  | Material.128   | 1         |                                 | OPAQUE    | ✓           |
| 13  | Material.127   | 1         |                                 | OPAQUE    | ✓           |
| 14  | Material.108   | 1         |                                 | OPAQUE    | ✓           |
| 15  | Material.103   | 1         |                                 | OPAQUE    | ✓           |
| 16  | Material.126   | 1         |                                 | OPAQUE    | ✓           |
| 17  | Material.118   | 3         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 18  | Material.117   | 2         |                                 | OPAQUE    | ✓           |
| 19  | Material.109   | 2         |                                 | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                           | instances | mimeType   | compression | resolution | size    | gpuSize⁵ |
| --- | ---  | --- | ---                             | ---       | ---        | ---         | ---        | ---     | ---      |
| 0   |      |     | baseColorTexture, normalTexture | 1         | image/webp |             | 512x512    | 8.21 KB | 1.4 MB   |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

