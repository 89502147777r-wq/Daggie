
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                 |
| ---                | ---                   |
| version            | 2.0                   |
| generator          | glTF-Transform v4.5.1 |
| extensionsUsed     | none                  |
| extensionsRequired | none                  |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName | bboxMin                      | bboxMax                  | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---      | ---                          | ---                      | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | Object_2 | -0.40002, -0.00028, -1.21215 | 0.39976, 0.7758, 0.74022 | 49,002             | 17,716            | 17,716                 |

¹ Expected number of vertices processed by the vertex shader for one render
  pass, without considering the vertex cache.

² Expected number of vertices uploaded to GPU, assuming each Accessor
  is uploaded only once. Actual number uploaded may be higher, 
  dependent on the implementation and vertex buffer layout.

³ Expected number of vertices uploaded to GPU, assuming each Primitive
  is uploaded once, duplicating vertex attributes shared among Primitives.



 MESHES
 ────────────────────────────────────────────
| #   | name     | mode      | meshPrimitives | glPrimitives | vertices | indices | attributes               | instances | size¹     |
| --- | ---      | ---       | ---            | ---          | ---      | ---     | ---                      | ---       | ---       |
| 0   | Object_0 | TRIANGLES | 1              | 16,334       | 17,716   | u16     | NORMAL:f32, POSITION:f32 | 1         | 523.19 KB |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name         | instances | textures | alphaMode | doubleSided |
| --- | ---          | ---       | ---      | ---       | ---         |
| 0   | Scene_-_Root | 1         |          | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
No textures found.


 ANIMATIONS
 ────────────────────────────────────────────
No animations found.

