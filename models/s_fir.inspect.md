
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
| #   | name            | rootName                  | bboxMin                     | bboxMax                    | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                       | ---                         | ---                        | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Fir01_LOD0_M_Branch.007_0 | -4.5181, -1.27684, -4.17515 | 4.16472, 12.14108, 3.97298 | 23,352             | 7,548             | 7,548                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                      | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                       | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Fir01_LOD0_M_Branch.007_0 | TRIANGLES | 1              | 3,392        | 4,240    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 223.87 KB |
| 1   | Fir01_LOD0_M_Bark.007_0   | TRIANGLES | 1              | 4,392        | 3,308    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 185.14 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name         | instances | textures                        | alphaMode | doubleSided |
| --- | ---          | ---       | ---                             | ---       | ---         |
| 0   | M_Branch.007 | 1         | baseColorTexture, normalTexture | MASK      | ✓           |
| 1   | M_Bark.007   | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 399.56 KB | 5.59 MB  |
| 1   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 92.79 KB  | 5.59 MB  |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 256x1024   | 80.65 KB  | 1.4 MB   |
| 3   |      |     | normalTexture    | 1         | image/webp |             | 256x1024   | 92.22 KB  | 1.4 MB   |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

