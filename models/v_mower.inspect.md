
 OVERVIEW
 ────────────────────────────────────────────
| key                | value                                                                            |
| ---                | ---                                                                              |
| version            | 2.0                                                                              |
| generator          | glTF-Transform v4.5.1                                                            |
| extensionsUsed     | KHR_materials_clearcoat, KHR_materials_emissive_strength, KHR_materials_specular |
| extensionsRequired | none                                                                             |



 SCENES
 ────────────────────────────────────────────
| #   | name            | rootName           | bboxMin                     | bboxMax                   | renderVertexCount¹ | uploadVertexCount | uploadNaiveVertexCount |
| --- | ---             | ---                | ---                         | ---                       | ---                | ---               | ---                    |
| 0   | Sketchfab_Scene | GLTF_SceneRootNode | -0.78263, 0.00434, -1.46686 | 0.78263, 1.59327, 1.46151 | 29,760             | 18,168            | 18,168                 |

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
| 0   | Object_0 | TRIANGLES | 1              | 8,280        | 16,200   | u16     | NORMAL:f32, POSITION:f32 | 1         | 438.48 KB |
| 1   | Object_1 | TRIANGLES | 1              | 576          | 1,152    | u16     | NORMAL:f32, POSITION:f32 | 1         | 31.1 KB   |
| 2   | Object_2 | TRIANGLES | 1              | 446          | 333      | u16     | NORMAL:f32, POSITION:f32 | 1         | 10.67 KB  |
| 3   | Object_3 | TRIANGLES | 1              | 610          | 474      | u16     | NORMAL:f32, POSITION:f32 | 1         | 15.04 KB  |
| 4   | Object_4 | TRIANGLES | 1              | 8            | 9        | u16     | NORMAL:f32, POSITION:f32 | 1         | 264 Bytes |

⁴ size estimates GPU memory required by a mesh, in isolation. If accessors are
  shared by other mesh primitives, but the meshes themselves are not reused, then
  the sum of all mesh sizes will overestimate the asset's total size. See "dedup".



 MATERIALS
 ────────────────────────────────────────────
| #   | name       | instances | textures | alphaMode | doubleSided |
| --- | ---        | ---       | ---      | ---       | ---         |
| 0   | Tire       | 2         |          | OPAQUE    | ✓           |
| 1   | Tire_2     | 2         |          | OPAQUE    | ✓           |
| 2   | Cart_Color | 1         |          | OPAQUE    | ✓           |



 TEXTURES
 ────────────────────────────────────────────
No textures found.


 ANIMATIONS
 ────────────────────────────────────────────
| #   | name      | channels | samplers | duration | keyframes | size      |
| --- | ---       | ---      | ---      | ---      | ---       | ---       |
| 0   | Animation | 3        | 3        | 0        | 29        | 424 Bytes |


