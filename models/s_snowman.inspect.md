
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                                    |
| ---                | ---                                      |
| version            | 2.0                                      |
| generator          | glTF-Transform v4.5.1                    |
| extensionsUsed     | EXT_texture_webp, KHR_materials_specular |
| extensionsRequired | EXT_texture_webp                         |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName                             | bboxMin                    | bboxMax                    | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                                  | ---                        | ---                        | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | mu��ecop de nieve_mu��eco de nieve_0 | 5.3283, -0.09075, -6.45833 | 7.97383, 2.43934, -4.92946 | 26,676             | 5,459             | 5,459                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                                 | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                            | instances | size¹     |
| --- | ---                                  | ---       | ---            | ---          | ---      | ---     | ---                                                   | ---       | ---       |
| 0   | mu��ecop de nieve_mu��eco de nieve_0 | TRIANGLES | 1              | 8,892        | 5,459    | u16     | NORMAL:f32, POSITION:f32, TANGENT:f32, TEXCOORD_0:f32 | 1         | 315.38 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name           | instances | textures                                                  | alphaMode | doubleSided |
| --- | ---            | ---       | ---                                                       | ---       | ---         |
| 0   | mueco_de_nieve | 1         | baseColorTexture, normalTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                    | instances | mimeType   | compression | resolution | size     | gpuSize⁵ |
| --- | ---  | --- | ---                      | ---       | ---        | ---         | ---        | ---      | ---      |
| 0   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 54.81 KB | 5.59 MB  |
| 1   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 25.69 KB | 5.59 MB  |
| 2   |      |     | normalTexture            | 1         | image/webp |             | 1024x1024  | 61.56 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

