
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
| #   | name            | rootName                                 | bboxMin                      | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                                      | ---                          | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Carnegiea_gigantea_HD_Cactus spines 01_0 | -0.08621, -0.00849, -0.08826 | 0.08639, 0.75556, 0.08261 | 17,100             | 5,323             | 5,323                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                                      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                                       | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Carnegiea_gigantea_HD_Cactus spines 01_0  | TRIANGLES | 1              | 2,736        | 3,648    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 191.52 KB |
| 1   | Carnegiea_gigantea_HD_Carnegiea bark 05_0 | TRIANGLES | 1              | 2,964        | 1,675    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 98.18 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name              | instances | textures                        | alphaMode | doubleSided |
| --- | ---               | ---       | ---                             | ---       | ---         |
| 0   | Cactus_spines_01  | 1         | baseColorTexture, normalTexture | BLEND     | ✓           |
| 1   | Carnegiea_bark_05 | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size     | gpuSize⁵  |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---      | ---       |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 25.24 KB | 5.59 MB   |
| 1   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 22.44 KB | 5.59 MB   |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 128x1024   | 13.68 KB | 699.07 KB |
| 3   |      |     | normalTexture    | 1         | image/webp |             | 128x1024   | 14.59 KB | 699.07 KB |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

