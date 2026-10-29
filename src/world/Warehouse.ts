import { Box3, BoxGeometry, DataTexture, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { WorldQuery } from '../shared/types';
import { PropFactory, PROP_DEFINITIONS } from './PropFactory';
import type { PropFootprint } from './PropFactory';
import { ARENA, LIGHT_POSITIONS, PICKUP_CLEARINGS, PROPS, SPAWNS } from './layout';

/** Static procedural arena; Game owns all updates and input. */
export class Warehouse implements WorldQuery {
  readonly root = new Group();
  readonly bounds = new Box3(new Vector3(-ARENA.width / 2, 0, -ARENA.depth / 2), new Vector3(ARENA.width / 2, ARENA.height, ARENA.depth / 2));
  readonly shotBlockers: Object3D[] = [];
  readonly spawnPoints = SPAWNS.map(([x, z]) => new Vector3(x, 0, z));
  private readonly obstacles: PropFootprint[] = [];
  private readonly pool = new PropFactory();
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly floorTexture = this.surface();
  private readonly materials = {
    floor: new MeshStandardMaterial({ color: 0x52616a, map: this.floorTexture, roughness: 0.95, metalness: 0.15 }),
    wall: new MeshStandardMaterial({ color: 0x304451, roughness: 0.85 }),
    steel: new MeshStandardMaterial({ color: 0x405866, roughness: 0.55, metalness: 0.6 }),
    yellow: new MeshStandardMaterial({ color: 0xd8ae48, roughness: 0.75 }),
    lamp: new MeshStandardMaterial({ color: 0xd5eaff, emissive: 0xb9dfff, emissiveIntensity: 2 }),
    warm: new MeshStandardMaterial({ color: 0xffcf87, emissive: 0xffb35a, emissiveIntensity: 2 }),
  };
  private disposed = false;

  constructor() {
    this.root.name = 'Warehouse';
    const { width, depth, height } = ARENA;
    this.box(width, 0.25, depth, 0, -0.125, 0, 'floor');
    for (const side of [-1, 1]) {
      this.box(0.5, height, depth, side * (width / 2 + 0.25), height / 2, 0, 'wall');
      this.box(width, height, 0.5, 0, height / 2, side * (depth / 2 + 0.25), 'wall');
      // Flush wall ribs and loading-door panels: no invisible inward collision lip.
      for (const z of [-24, -12, 0, 12, 24]) this.box(0.04, height, 0.22, side * 20.02, height / 2, z, 'steel');
      this.box(8, 5, 0.04, 0, 2.5, side * 28.02, 'steel');
      for (let y = 0.5; y < 5; y += 0.5) this.box(7.8, 0.035, 0.02, 0, y, side * 28.005, 'yellow');
    }
    for (const placement of PROPS) {
      const { kind, x, z } = placement;
      const [sx, sy, sz] = placement.scale ?? [1, 1, 1];
      const prop = kind === 'rack' ? this.pool.createRack() : kind === 'crate' ? this.pool.createCrate() : kind === 'barrel' ? this.pool.createBarrel() : this.pool.createPallet();
      prop.position.set(x, 0, z);
      prop.scale.set(sx, sy, sz);
      this.root.add(prop);
      prop.traverse(object => { if (object instanceof Mesh) this.shotBlockers.push(object); });
      for (const footprint of PROP_DEFINITIONS[kind].footprints) {
        if (footprint.kind === 'circle') {
          if (sx !== sz) throw new Error('Circular props require uniform XZ scale');
          this.obstacles.push({ kind: 'circle', x: x + footprint.x * sx, z: z + footprint.z * sz, radius: footprint.radius * sx });
        } else this.obstacles.push({ kind: 'box', x: x + footprint.x * sx, z: z + footprint.z * sz, width: footprint.width * sx, depth: footprint.depth * sz });
      }
    }
    for (const z of [-18, -6, 6, 18]) {
      this.box(width, 0.3, 0.3, 0, 8.7, z, 'steel');
      for (const x of [-4.5, 4.5]) this.box(0.1, 0.004, 8, x, 0.003, z, 'yellow', false);
    }
    // Flat paint is decorative, never a floating bullet blocker.
    for (const [x, z] of PICKUP_CLEARINGS) {
      for (const side of [-1, 1]) {
        this.box(2.8, 0.004, 0.08, x, 0.003, z + side * 1.4, 'yellow', false);
        this.box(0.08, 0.004, 2.8, x + side * 1.4, 0.003, z, 'yellow', false);
      }
    }
    LIGHT_POSITIONS.forEach(([x, y, z], i) => {
      this.box(2.3, 0.18, 0.65, x, y + 0.15, z, 'steel');
      this.box(2, 0.06, 0.45, x, y + 0.03, z, i === 3 ? 'warm' : 'lamp');
    });
    this.root.updateMatrixWorld(true);
  }

  canOccupy(position: Vector3, radius: number): boolean {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(radius) || radius < 0) return false;
    if (position.x - radius < this.bounds.min.x || position.x + radius > this.bounds.max.x ||
        position.z - radius < this.bounds.min.z || position.z + radius > this.bounds.max.z) return false;
    return !this.obstacles.some(p => {
      if (p.kind === 'circle') return (position.x - p.x) ** 2 + (position.z - p.z) ** 2 < (radius + p.radius) ** 2;
      const dx = Math.max(Math.abs(position.x - p.x) - p.width / 2, 0);
      const dz = Math.max(Math.abs(position.z - p.z) - p.depth / 2, 0);
      return (dx === 0 && dz === 0) || dx * dx + dz * dz < radius * radius;
    });
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, surface: keyof Warehouse['materials'], blocksShots = true): void {
    const mesh = new Mesh(this.geometry, this.materials[surface]);
    mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
    this.root.add(mesh);
    if (blocksShots) this.shotBlockers.push(mesh);
  }

  private surface(): DataTexture {
    const size = 64, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const value = x === 0 || y === 0 ? 145 : 178 + (((Math.imul(x + y * size, 1664525) >>> 16) % 7));
      const i = (y * size + x) * 4;
      data.set([value, value, value, 255], i);
    }
    const texture = new DataTexture(data, size, size, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(10, 14); texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.pool.dispose(); this.root.clear(); this.shotBlockers.length = 0;
    this.geometry.dispose(); this.floorTexture.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
