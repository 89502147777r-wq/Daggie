
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
| #   | name            | rootName        | bboxMin                      | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---             | ---                          | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | defaultMaterial | -2.04745, -0.77438, -0.61657 | 2.09609, 0.85444, 0.61657 | 56,238             | 33,912            | 33,912                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name            | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---             | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | defaultMaterial | TRIANGLES | 1              | 6,283        | 9,774    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 506.85 KB |
| 1   | defaultMaterial | TRIANGLES | 1              | 1,725        | 2,840    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 146.67 KB |
| 2   | defaultMaterial | TRIANGLES | 1              | 10,738       | 21,298   | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 1.09 MB   |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name   | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---    | ---       | ---                                                                         | ---       | ---         |
| 0   | wheels | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 1   | armata | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | Steel  | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 139.66 KB | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 204.23 KB | 5.59 MB  |
| 2   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 110.16 KB | 5.59 MB  |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 50.64 KB  | 5.59 MB  |
| 4   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 63.85 KB  | 5.59 MB  |
| 5   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 21.48 KB  | 5.59 MB  |
| 6   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 77.53 KB  | 5.59 MB  |
| 7   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 36.77 KB  | 5.59 MB  |
| 8   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 111.05 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

