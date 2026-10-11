
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
| #   | name            | rootName         | bboxMin                          | bboxMax                        | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---              | ---                              | ---                            | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Door_Exterior4_0 | -322.66943, -0.00997, -170.76944 | 321.17157, 355.19313, 262.8782 | 6,258              | 2,773             | 2,773                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name             | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---              | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Door_Exterior4_0 | TRIANGLES | 1              | 1,344        | 1,298    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 70.37 KB  |
| 1   | Main_Exterior2_0 | TRIANGLES | 1              | 334          | 662      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 33.78 KB  |
| 2   | Main_Exterior1_0 | TRIANGLES | 1              | 88           | 172      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 8.78 KB   |
| 3   | Main_Interior_0  | TRIANGLES | 1              | 92           | 187      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 9.53 KB   |
| 4   | Main_Exterior3_0 | TRIANGLES | 1              | 220          | 438      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 22.34 KB  |
| 5   | Main_Glass_0     | TRIANGLES | 1              | 8            | 16       | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 816 Bytes |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name      | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---       | ---       | ---                                                                         | ---       | ---         |
| 0   | Exterior4 | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 1   | Exterior2 | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | Exterior1 | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 3   | Interior  | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 4   | Exterior3 | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 5   | Glass     | 1         | baseColorTexture, occlusionTexture, metallicRoughnessTexture                | BLEND     |             |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 118.38 KB | 5.59 MB  |
| 1   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 59.35 KB  | 5.59 MB  |
| 2   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 20.22 KB  | 5.59 MB  |
| 3   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 151.41 KB | 5.59 MB  |
| 4   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 144.35 KB | 5.59 MB  |
| 5   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 18.03 KB  | 5.59 MB  |
| 6   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 118.51 KB | 5.59 MB  |
| 7   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 135.87 KB | 5.59 MB  |
| 8   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 31.23 KB  | 5.59 MB  |
| 9   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 99.02 KB  | 5.59 MB  |
| 10  |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 18.73 KB  | 5.59 MB  |
| 11  |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 22.01 KB  | 5.59 MB  |
| 12  |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 73.33 KB  | 5.59 MB  |
| 13  |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 45.95 KB  | 5.59 MB  |
| 14  |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 25.27 KB  | 5.59 MB  |
| 15  |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 611.64 KB | 5.59 MB  |
| 16  |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 114.67 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

