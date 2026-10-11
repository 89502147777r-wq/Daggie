
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
| #   | name            | rootName                                 | bboxMin                      | bboxMax                  | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                                      | ---                          | ---                      | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Carnegiea_gigantea_HD_Cactus spines 01_0 | -0.34306, -0.02588, -0.21539 | 0.3742, 2.86935, 0.34455 | 53,685             | 19,408            | 19,408                 |

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
| 0   | Carnegiea_gigantea_HD_Cactus spines 01_0  | TRIANGLES | 1              | 11,697       | 15,596   | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 818.79 KB |
| 1   | Carnegiea_gigantea_HD_Carnegiea bark 04_0 | TRIANGLES | 1              | 3,066        | 1,743    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 102.06 KB |
| 2   | Carnegiea_gigantea_HD_Carnegiea bark 05_0 | TRIANGLES | 1              | 3,132        | 2,069    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 118.1 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name              | instances | textures                        | alphaMode | doubleSided |
| --- | ---               | ---       | ---                             | ---       | ---         |
| 0   | Cactus_spines_01  | 1         | baseColorTexture, normalTexture | BLEND     | ✓           |
| 1   | Carnegiea_bark_04 | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 2   | Carnegiea_bark_05 | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size     | gpuSize⁵  |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---      | ---       |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 25.24 KB | 5.59 MB   |
| 1   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 22.44 KB | 5.59 MB   |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 128x1024   | 13.12 KB | 699.07 KB |
| 3   |      |     | normalTexture    | 1         | image/webp |             | 128x1024   | 14.44 KB | 699.07 KB |
| 4   |      |     | baseColorTexture | 1         | image/webp |             | 128x1024   | 13.68 KB | 699.07 KB |
| 5   |      |     | normalTexture    | 1         | image/webp |             | 128x1024   | 14.59 KB | 699.07 KB |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

