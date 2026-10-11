
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
| #   | name            | rootName                                           | bboxMin                      | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                                                | ---                          | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Pindad Mo-1 Kal. 60 mm CO_Pindad Mo-1 Kal. 60 mm_0 | -2.52121, -0.05467, -0.18981 | 0.52121, 1.04848, 0.82411 | 32,532             | 10,625            | 10,625                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                                               | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                                                            | instances | size¹     |
| --- | ---                                                | ---       | ---            | ---          | ---      | ---     | ---                                                                                   | ---       | ---       |
| 0   | Pindad Mo-1 Kal. 60 mm CO_Pindad Mo-1 Kal. 60 mm_0 | TRIANGLES | 1              | 1,626        | 1,679    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32                                 | 1         | 90.35 KB  |
| 1   | Pindad Mo-2 Kal. 60 mm LR_Base and Mortar_0        | TRIANGLES | 1              | 1,002        | 847      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32, TEXCOORD_1:f32, TEXCOORD_2:f32 | 1         | 46.67 KB  |
| 2   | Pindad Mo-2 Kal. 60 mm LR_Small Parts_0            | TRIANGLES | 1              | 4,150        | 4,150    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32, TEXCOORD_1:f32, TEXCOORD_2:f32 | 1         | 224.1 KB  |
| 3   | Pindad Mo-3 Kal. 81 mm_Small Parts 2_0             | TRIANGLES | 1              | 3,064        | 3,102    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32                                 | 1         | 167.28 KB |
| 4   | Base_Base and Mortar 2_0                           | TRIANGLES | 1              | 1,002        | 847      | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32, TEXCOORD_1:f32, TEXCOORD_2:f32 | 1         | 60.22 KB  |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name                   | instances | textures                                                  | alphaMode | doubleSided |
| --- | ---                    | ---       | ---                                                       | ---       | ---         |
| 0   | Pindad_Mo-1_Kal._60_mm | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 1   | Base_and_Mortar        | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 2   | Small_Parts            | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |
| 3   | Small_Parts_2          | 1         | baseColorTexture, normalTexture                           | OPAQUE    | ✓           |
| 4   | Base_and_Mortar_2      | 1         | baseColorTexture, normalTexture                           | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                    | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                      | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 130.61 KB | 5.59 MB  |
| 1   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 144.55 KB | 5.59 MB  |
| 2   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 6.04 KB   | 5.59 MB  |
| 3   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 117.7 KB  | 5.59 MB  |
| 4   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 65.13 KB  | 5.59 MB  |
| 5   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 8.07 KB   | 5.59 MB  |
| 6   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 75.35 KB  | 5.59 MB  |
| 7   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 50.8 KB   | 5.59 MB  |
| 8   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 9.26 KB   | 5.59 MB  |
| 9   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 89.47 KB  | 5.59 MB  |
| 10  |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 17.54 KB  | 5.59 MB  |
| 11  |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 115.54 KB | 5.59 MB  |
| 12  |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 15.61 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

