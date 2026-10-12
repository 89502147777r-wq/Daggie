
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
| #   | name            | rootName        | bboxMin                   | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---             | ---                       | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Sketchfab_model | 1.35381, 0.0246, -3.65381 | 3.70351, 2.82793, 6.30695 | 48,846             | 31,525            | 31,525                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name     | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                                                               | instances | size¹   |
| --- | ---      | ---       | ---            | ---          | ---      | ---     | ---                                                                      | ---       | ---     |
| 0   | Object_0 | TRIANGLES | 1              | 16,282       | 31,525   | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32, TEXCOORD_1:f32, TEXCOORD_2:f32 | 1         | 1.11 MB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name         | instances | textures                                                    | alphaMode | doubleSided |
| --- | ---          | ---       | ---                                                         | ---       | ---         |
| 0   | Material.001 | 1         | baseColorTexture, emissiveTexture, metallicRoughnessTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots                    | instances | mimeType   | compression | resolution | size      | gpuSize⁵ |
| --- | ---  | --- | ---                      | ---       | ---        | ---         | ---        | ---       | ---      |
| 0   |      |     | baseColorTexture         | 1         | image/webp |             | 1024x1024  | 76.42 KB  | 5.59 MB  |
| 1   |      |     | metallicRoughnessTexture | 1         | image/webp |             | 1024x1024  | 102.31 KB | 5.59 MB  |
| 2   |      |     | emissiveTexture          | 1         | image/webp |             | 1024x1024  | 7.5 KB    | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

