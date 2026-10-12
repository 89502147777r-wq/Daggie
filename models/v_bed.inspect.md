
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
| #   | name            | rootName              | bboxMin                        | bboxMax                       | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                   | ---                            | ---                           | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | low_Pillow_1_pillow_0 | -93.93197, -0.06384, -60.40959 | 92.71434, 139.24912, 62.28649 | 11,964             | 3,991             | 3,991                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                  | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                   | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | low_Pillow_1_pillow_0 | TRIANGLES | 1              | 166          | 159      | u16     | NORMAL:f32, POSITION:f32                              | 1         | 4.81 KB   |
| 1   | low_Pillow_1_lagen_0  | TRIANGLES | 1              | 1,998        | 1,970    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 106.55 KB |
| 2   | low_Pillow_1_bed_0    | TRIANGLES | 1              | 1,824        | 1,862    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32              | 1         | 70.53 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name     | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---      | ---       | ---                                                                         | ---       | ---         |
| 0   | pillow   | 1         |                                                                             | OPAQUE    | ✓           |
| 1   | lagen    | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | material | 1         | baseColorTexture, metallicRoughnessTexture                                  | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 60.25 KB  | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 59.64 KB  | 5.59 MB  |
| 2   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 107.03 KB | 5.59 MB  |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 98.39 KB  | 5.59 MB  |
| 4   |      |     | metallicRoughnessTexture                   | 1         | image/webp |             | 1024x1024  | 14.51 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

