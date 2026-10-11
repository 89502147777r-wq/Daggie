
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
| #   | name            | rootName                       | bboxMin                        | bboxMax                       | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                            | ---                            | ---                           | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | OfficeChair_OfficeChairMetal_0 | -48.61279, -0.56935, -42.31339 | 48.67996, 125.25927, 50.31781 | 28,350             | 7,437             | 7,437                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                             | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                              | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | OfficeChair_OfficeChairMetal_0   | TRIANGLES | 1              | 1,248        | 1,109    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 60.72 KB  |
| 1   | OfficeChair_OfficeChairPlastic_0 | TRIANGLES | 1              | 6,464        | 5,143    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 285.65 KB |
| 2   | OfficeChair_OfficeChairCloth_0   | TRIANGLES | 1              | 986          | 529      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 31.31 KB  |
| 3   | OfficeChair_OfficeChairLeather_0 | TRIANGLES | 1              | 752          | 656      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 36 KB     |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name               | instances | textures                                                                    | alphaMode | doubleSided |
| --- | ---                | ---       | ---                                                                         | ---       | ---         |
| 0   | OfficeChairMetal   | 1         | normalTexture, occlusionTexture, metallicRoughnessTexture                   | OPAQUE    | ✓           |
| 1   | OfficeChairPlastic | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | OfficeChairCloth   | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 3   | OfficeChairLeather | 1         | baseColorTexture, normalTexture, occlusionTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                                      | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                                        | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 52.88 KB  | 5.59 MB  |
| 1   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 2.01 KB   | 5.59 MB  |
| 2   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 21.43 KB  | 5.59 MB  |
| 3   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 47.23 KB  | 5.59 MB  |
| 4   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 5.88 KB   | 5.59 MB  |
| 5   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 145.13 KB | 5.59 MB  |
| 6   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 49.36 KB  | 5.59 MB  |
| 7   |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 121.77 KB | 5.59 MB  |
| 8   |      |     | baseColorTexture                           | 1         | image/webp |             | 1024x1024  | 10.17 KB  | 5.59 MB  |
| 9   |      |     | occlusionTexture, metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 46.42 KB  | 5.59 MB  |
| 10  |      |     | normalTexture                              | 1         | image/webp |             | 1024x1024  | 70.3 KB   | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

