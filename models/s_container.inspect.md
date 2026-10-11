
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
| #   | name            | rootName      | bboxMin               | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---           | ---                   | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | frame_frame_0 | -6.33078, -1, -3.4544 | 6.51808, 4.92812, 3.24175 | 33,294             | 8,944             | 8,944                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                          | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                           | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | frame_frame_0                 | TRIANGLES | 1              | 1,966        | 1,724    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 94.55 KB  |
| 1   | right door_front doors_0      | TRIANGLES | 1              | 8,788        | 6,576    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 368.38 KB |
| 2   | right side_corrugated sides_0 | TRIANGLES | 1              | 344          | 644      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 32.98 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name             | instances | textures                                                  | alphaMode | doubleSided |
| --- | ---              | ---       | ---                                                       | ---       | ---         |
| 0   | frame            | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 1   | front_doors      | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | corrugated_sides | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                    | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                      | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 54.31 KB  | 5.59 MB  |
| 1   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 141.43 KB | 5.59 MB  |
| 2   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 54.49 KB  | 5.59 MB  |
| 3   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 84.41 KB  | 5.59 MB  |
| 4   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 99.96 KB  | 5.59 MB  |
| 5   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 48.68 KB  | 5.59 MB  |
| 6   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 86.7 KB   | 5.59 MB  |
| 7   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 111.18 KB | 5.59 MB  |
| 8   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 46.21 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

