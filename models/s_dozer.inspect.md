
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
| #   | name            | rootName                     | bboxMin                    | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                          | ---                        | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Box001_mesh_Material_u1_v1_0 | -0.37822, 0.0095, -0.27037 | 0.34356, 0.50625, 0.27172 | 13,686             | 5,191             | 5,191                  |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name                         | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes                               | instances | size¹     |
| --- | ---                          | ---       | ---            | ---          | ---      | ---     | ---                                      | ---       | ---       |
| 0   | Box001_mesh_Material_u1_v1_0 | TRIANGLES | 1              | 4,562        | 5,191    | u16     | NORMAL:f32, POSITION:f32, TEXCOORD_0:f32 | 1         | 193.48 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name                | instances | textures         | alphaMode | doubleSided |
| --- | ---                 | ---       | ---              | ---       | ---         |
| 0   | mesh_Material_u1_v1 | 1         | baseColorTexture | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
| #   | name | uri | slots            | instances | mimeType   | compression | resolution | size     | gpuSize⁵ |
| --- | ---  | --- | ---              | ---       | ---        | ---         | ---        | ---      | ---      |
| 0   |      |     | baseColorTexture | 1         | image/webp |             | 1024x1024  | 64.48 KB | 5.59 MB  |

⁵ gpuSize estimates minimum VRAM memory allocation. Older devices may require
  additional memory for GPU compression formats.



 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

