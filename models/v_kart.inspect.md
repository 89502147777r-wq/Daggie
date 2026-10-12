
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
| #   | name            | rootName              | bboxMin              | bboxMax                | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                   | ---                  | ---                    | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Coque_low_CycleKart_0 | -0.53517, 0, -1.4033 | 0.53517, 1.00455, 1.33 | 40,857             | 9,710             | 9,710                  |

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
| 0   | Coque_low_CycleKart_0 | TRIANGLES | 1              | 6,179        | 4,518    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 253.94 KB |
| 1   | Pneu_low_Wheel4_0     | TRIANGLES | 1              | 7,440        | 5,192    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 293.86 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name      | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---       | ---       | ---                                                                         | ---       | ---         |
| 0   | CycleKart | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | BLEND     |             |
| 1   | Wheel4    | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 102.67 KB | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 99.63 KB  | 5.59 MB  |
| 2   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 111.48 KB | 5.59 MB  |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 88.88 KB  | 5.59 MB  |
| 4   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 101.08 KB | 5.59 MB  |
| 5   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 46.37 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

