
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                                                                                    |
| ---                | ---                                                                                      |
| version            | 2.0                                                                                      |
| generator          | glTF-Transform v4.5.1                                                                    |
| extensionsUsed     | EXT_texture_webp, KHR_materials_clearcoat, KHR_materials_specular, KHR_texture_transform |
| extensionsRequired | EXT_texture_webp                                                                         |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName                                                   | bboxMin                     | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                                                        | ---                         | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Negotiator80_Glass_back_UCB_Lights_and_Glass_Transperent_0 | -2.4883, -0.00221, -0.93507 | 2.45167, 1.39124, 0.93986 | 59,295             | 18,055            | 18,055                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                                                       | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                               | instances | size¹     |
| --- | ---                                                        | ---       | ---            | ---          | ---      | ---     | ---                                      | ---       | ---       |
| 0   | Negotiator80_Glass_back_UCB_Lights_and_Glass_Transperent_0 | TRIANGLES | 1              | 380          | 473      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 17.42 KB  |
| 1   | Negotiator80_Hood_Negotiator80_Bodymat_0                   | TRIANGLES | 1              | 4,004        | 3,437    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 134.01 KB |
| 2   | Negotiator80_suspension_UCB_BOTTOM_0                       | TRIANGLES | 1              | 8,752        | 8,258    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 316.77 KB |
| 3   | Negotiator80_Interior_UCB_Interiors_2_0                    | TRIANGLES | 1              | 3,357        | 2,901    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 112.97 KB |
| 4   | Negotiator80_Headlights_UCB_Lights_and_Glass_0             | TRIANGLES | 1              | 348          | 298      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 11.62 KB  |
| 5   | Negotiator80_Trunk_door_Badges_Carbadges_misc_U_0          | TRIANGLES | 1              | 32           | 64       | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 2.24 KB   |
| 6   | Negotiator80_WheelStock_FL_RB1c_Tire_1k_0                  | TRIANGLES | 1              | 2,732        | 2,432    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 94.22 KB  |
| 7   | Negotiator80_Numberplate_rear_Numberplates_Misk_U_0        | TRIANGLES | 1              | 160          | 192      | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 7.1 KB    |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name                             | instances | textures                                                                      | alphaMode | doubleSided |
| --- | ---                              | ---       | ---                                                                           | ---       | ---         |
| 0   | UCB_Lights_and_Glass_Transperent | 1         | baseColorTexture                                                              | BLEND     | ✓           |
| 1   | Negotiator80_Bodymat             | 1         | occlusionTexture, metallicRoughnessTexture, specularTexture                   | OPAQUE    | ✓           |
| 2   | UCB_BOTTOM                       | 1         | baseColorTexture, occlusionTexture, metallicRoughnessTexture, specularTexture | OPAQUE    | ✓           |
| 3   | UCB_Interiors_2                  | 1         | baseColorTexture, metallicRoughnessTexture                                    | OPAQUE    | ✓           |
| 4   | UCB_Lights_and_Glass             | 1         | baseColorTexture                                                              | OPAQUE    | ✓           |
| 5   | RB1c_Tire_1k                     | 1         | baseColorTexture, occlusionTexture, metallicRoughnessTexture, specularTexture | OPAQUE    | ✓           |
| 6   | Numberplates_Misk_U              | 1         | baseColorTexture                                                              | BLEND     | ✓           |
| 7   | Carbadges_misc_U                 | 1         | baseColorTexture                                                              | BLEND     | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                           | 2         | image/webp |             | 1024x1024  | 67.51 KB  | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 106.9 KB  | 5.59 MB  |
| 2   |      |     | specularTexture                            | 1         | image/webp |             | 512x512    | 8.46 KB   | 1.4 MB   |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 67.94 KB  | 5.59 MB  |
| 4   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 78.89 KB  | 5.59 MB  |
| 5   |      |     | specularTexture                            | 1         | image/webp |             | 1024x1024  | 313.63 KB | 5.59 MB  |
| 6   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 33.48 KB  | 5.59 MB  |
| 7   |      |     | metallicRoughnessTexture                   | 1         | image/webp |             | 1024x1024  | 29.36 KB  | 5.59 MB  |
| 8   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 30.85 KB  | 5.59 MB  |
| 9   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 69.77 KB  | 5.59 MB  |
| 10  |      |     | specularTexture                            | 1         | image/webp |             | 1024x1024  | 307.14 KB | 5.59 MB  |
| 11  |      |     | baseColorTexture                           | 1         | image/webp |             | 512x512    | 43.12 KB  | 1.4 MB   |
| 12  |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 370.76 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

