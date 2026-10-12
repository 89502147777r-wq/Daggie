
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
| #   | name            | rootName        | bboxMin               | bboxMax            | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---             | ---                   | ---                | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Sketchfab_model | -0.33271, -1, -0.3327 | 0.33271, 1, 0.3327 | 43,986             | 15,794            | 15,794                 |

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
| 0   | defaultMaterial | TRIANGLES | 1              | 10,342       | 13,002   | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 686.15 KB |
| 1   | defaultMaterial | TRIANGLES | 1              | 3,968        | 2,474    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 142.56 KB |
| 2   | defaultMaterial | TRIANGLES | 1              | 352          | 318      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 17.38 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name      | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---       | ---       | ---                                                                         | ---       | ---         |
| 0   | Windows   | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | BLEND     | ✓           |
| 1   | MetalPart | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | BLEND     | ✓           |
| 2   | Red_Part  | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size     | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---      | ---      |
| 0   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 35.59 KB | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 7.97 KB  | 5.59 MB  |
| 2   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 2.03 KB  | 5.59 MB  |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 7.03 KB  | 5.59 MB  |
| 4   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 13.63 KB | 5.59 MB  |
| 5   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 2.35 KB  | 5.59 MB  |
| 6   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 22.11 KB | 5.59 MB  |
| 7   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 64.52 KB | 5.59 MB  |
| 8   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 9.72 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

