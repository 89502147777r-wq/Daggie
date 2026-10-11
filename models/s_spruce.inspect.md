
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
| #   | name            | rootName                 | bboxMin                      | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                      | ---                          | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Spruce_LOD0_M_Bark.001_0 | -3.74193, -0.83063, -4.18906 | 4.35356, 16.59087, 4.2343 | 31,161             | 9,555             | 9,555                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                       | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                        | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | Spruce_LOD0_M_Bark.001_0   | TRIANGLES | 1              | 4,785        | 3,381    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 191 KB    |
| 1   | Spruce_LOD0_M_Branch.001_0 | TRIANGLES | 1              | 5,602        | 6,174    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 329.96 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name         | instances | textures                        | alphaMode | doubleSided |
| --- | ---          | ---       | ---                             | ---       | ---         |
| 0   | M_Bark.001   | 1         | baseColorTexture, normalTexture | OPAQUE    | ✓           |
| 1   | M_Branch.001 | 1         | baseColorTexture, normalTexture | MASK      | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 256x1024   | 111.52 KB | 1.4 MB   |
| 1   |      |     | normalTexture    | 1         | image/webp |             | 256x1024   | 119.07 KB | 1.4 MB   |
| 2   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 304.23 KB | 5.59 MB  |
| 3   |      |     | normalTexture    | 1         | image/webp |             | 1024x1024  | 72.52 KB  | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

