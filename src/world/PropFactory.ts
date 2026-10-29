import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type PropKind = 'crate' | 'barrel' | 'pallet' | 'rack';
/** Local XZ footprint. Rack posts are separate so its empty bay stays walkable. */
export type PropFootprint =
  | { readonly kind: 'box'; readonly x: number; readonly z: number; readonly width: number; readonly depth: number }
  | { readonly kind: 'circle'; readonly x: number; readonly z: number; readonly radius: number };
export interface PropDefinition {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly footprints: readonly PropFootprint[];
}
const box = (width: number, depth: number, x = 0, z = 0): PropFootprint =>
  Object.freeze({ kind: 'box', x, z, width, depth });
const definition = (width: number, height: number, depth: number, footprints: PropFootprint[]): PropDefinition =>
  Object.freeze({ width, height, depth, footprints: Object.freeze(footprints) });

/** Metres, Y-up, XZ-centred origins on the floor. Includes all raised details. */
export const PROP_DEFINITIONS: Readonly<Record<PropKind, PropDefinition>> = Object.freeze({
  crate: definition(1, 1, 1, [box(1, 1)]),
  barrel: definition(0.7, 1.1, 0.7, [Object.freeze({ kind: 'circle', x: 0, z: 0, radius: 0.35 })]),
  pallet: definition(1.2, 0.18, 1, [box(1.2, 1)]),
  rack: definition(3.4, 6, 7, [-1.5, 1.5].flatMap(x => [-3.2, 3.2].map(z => box(0.16, 0.16, x, z)))),
});

type Surface = 'wood' | 'frame' | 'steel' | 'yellow';

/** Own one pool per warehouse. Returned roots own transforms only; geometry and
 * materials belong exclusively to this pool. release() removes one instance;
 * dispose() detaches ALL instances before releasing shared GPU resources.
 * Do not manually clone roots or dispose/mutate their shared resources.
 */
export class PropFactory {
  private readonly unitBox = new BoxGeometry(1, 1, 1);
  private readonly unitCylinder = new CylinderGeometry(1, 1, 1, 16);
  private readonly materials = {
    wood: new MeshStandardMaterial({ color: 0x584635, roughness: 0.95 }),
    frame: new MeshStandardMaterial({ color: 0x8a6c48, roughness: 0.9 }),
    steel: new MeshStandardMaterial({ color: 0x344b59, roughness: 0.55, metalness: 0.65 }),
    yellow: new MeshStandardMaterial({ color: 0xc59633, roughness: 0.65, metalness: 0.35 }),
  };
  private readonly templates = new Map<PropKind, Group>();
  private readonly instances = new Set<Group>();
  private disposed = false;

  createCrate(): Group { return this.create('crate'); }
  createBarrel(): Group { return this.create('barrel'); }
  createPallet(): Group { return this.create('pallet'); }
  createRack(): Group { return this.create('rack'); }

  private create(kind: PropKind): Group {
    if (this.disposed) throw new Error('PropFactory is disposed');
    let template = this.templates.get(kind);
    if (!template) {
      template = this.build(kind);
      this.templates.set(kind, template);
    }
    const root = template.clone(true);
    this.instances.add(root);
    return root;
  }

  private build(kind: PropKind): Group {
    const parts = new Map<Surface, BufferGeometry[]>();
    const part = (surface: Surface, w: number, h: number, d: number,
      x: number, y: number, z: number, cylinder = false): void => {
      const geometry = (cylinder ? this.unitCylinder : this.unitBox).clone();
      geometry.scale(w, h, d).translate(x, y, z);
      const bucket = parts.get(surface) ?? [];
      bucket.push(geometry);
      parts.set(surface, bucket);
    };
    if (kind === 'crate') {
      // Recessed solid body; raised rails on every face, contained in 1m bounds.
      part('wood', 0.92, 0.92, 0.92, 0, 0.5, 0);
      for (const side of [-1, 1]) {
        for (const offset of [-0.44, 0.44]) {
          part('frame', 0.12, 1, 0.04, offset, 0.5, side * 0.48);
          part('frame', 0.76, 0.12, 0.04, 0, 0.5 + offset, side * 0.48);
          part('frame', 0.04, 1, 0.12, side * 0.48, 0.5, offset);
          part('frame', 0.04, 0.12, 0.76, side * 0.48, 0.5 + offset, 0);
          part('frame', 0.12, 0.04, 0.92, offset, 0.5 + side * 0.48, 0);
        }
      }
    } else if (kind === 'barrel') {
      part('steel', 0.33, 1.06, 0.33, 0, 0.55, 0, true);
      // Four rolled hoops/lips and a small lid bung, no expensive torus meshes.
      for (const y of [0.02, 0.3, 0.8, 1.08]) part('yellow', 0.35, 0.04, 0.35, 0, y, 0, true);
      part('steel', 0.045, 0.02, 0.045, 0.16, 1.09, 0, true);
    } else if (kind === 'pallet') {
      for (const x of [-0.45, 0, 0.45]) part('wood', 0.14, 0.12, 1, x, 0.06, 0);
      for (const z of [-0.41, -0.205, 0, 0.205, 0.41]) part('frame', 1.2, 0.06, 0.18, 0, 0.15, z);
    } else {
      for (const x of [-1.5, 1.5]) for (const z of [-3.2, 3.2]) {
        part('steel', 0.16, 6, 0.16, x, 3, z);
      }
      for (const y of [2.7, 5.4]) {
        // Steel shelf deck with a yellow perimeter; empty ground bay.
        part('steel', 3.08, 0.08, 6.68, 0, y, 0);
        for (const x of [-1.62, 1.62]) part('yellow', 0.16, 0.2, 7, x, y, 0);
        for (const z of [-3.42, 3.42]) part('yellow', 3.08, 0.2, 0.16, 0, y, z);
      }
    }
    const root = new Group();
    root.name = `Procedural:${kind}`;
    // Bake static details into one mesh per surface: just two draws per prop.
    for (const [surface, geometries] of parts) {
      const merged = mergeGeometries(geometries);
      for (const geometry of geometries) geometry.dispose();
      if (!merged) throw new Error(`Cannot merge ${kind} geometry`);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, this.materials[surface]);
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    return root;
  }

  release(root: Group): void {
    if (!this.instances.delete(root)) return;
    root.removeFromParent();
    root.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const root of this.instances) this.release(root);
    for (const template of this.templates.values()) {
      template.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
      template.clear();
    }
    this.templates.clear();
    this.unitBox.dispose();
    this.unitCylinder.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
