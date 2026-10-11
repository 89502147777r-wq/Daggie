
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
| #   | name            | rootName    | bboxMin                     | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---         | ---                         | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Rels_RELS_0 | -1.25298, 0.02367, -3.70567 | 1.23964, 2.20201, 2.82011 | 103,953            | 32,320            | 32,320                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name               | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Rels_RELS_0        | TRIANGLES | 1              | 8,484        | 13,772   | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 711.96 KB |
| 1   | tower002_TOWER_0   | TRIANGLES | 1              | 8,192        | 5,288    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 302.98 KB |
| 2   | 0_0_Body001_BODY_0 | TRIANGLES | 1              | 17,975       | 13,260   | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 744.33 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name  | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---   | ---       | ---                                                                         | ---       | ---         |
| 0   | RELS  | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 1   | TOWER | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | BODY  | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 252.26 KB | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 323.75 KB | 5.59 MB  |
| 2   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 110.15 KB | 5.59 MB  |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 63.22 KB  | 5.59 MB  |
| 4   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 134.29 KB | 5.59 MB  |
| 5   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 38 KB     | 5.59 MB  |
| 6   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 79.15 KB  | 5.59 MB  |
| 7   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 182.51 KB | 5.59 MB  |
| 8   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 66.38 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

