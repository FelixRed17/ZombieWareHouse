import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { WORLD_ASSETS } from './worldAssets';
import type { WorldPropKind } from './worldAssets';

export interface WorldPropInstance {
  readonly root: Group;
  /** Resolves without throwing; fallback remains visible on missing/failed assets. */
  readonly ready: Promise<'loaded' | 'fallback' | 'disposed'>;
  dispose(): void;
}

type LoadScene = (url: string) => Promise<Object3D>;

/** One cache per world lifetime. Dispose instances, then the cache at world teardown.
 * Clones share immutable geometry/material/texture resources: callers must not dispose
 * or mutate those resources. No input handlers, gameplay timers or render loops.
 */
export class WorldAssetLoader {
  private readonly cache = new Map<string, Promise<Object3D | null>>();
  private readonly templates = new Set<Object3D>();
  private readonly instances = new Set<WorldPropInstance>();
  private readonly fallbacks = new Map<WorldPropKind, Object3D>();
  private disposed = false;
  private readonly loadScene: LoadScene;

  constructor(loadScene?: LoadScene, private readonly reportFailure = (url: string, error: unknown): void => {
    console.warn(`[WorldAssetLoader] Retaining fallback for ${url}`, error);
  }) {
    const loader = new GLTFLoader();
    this.loadScene = loadScene ?? (async (url) => (await loader.loadAsync(url)).scene);
  }

  create(kind: WorldPropKind): WorldPropInstance {
    if (this.disposed) throw new Error('WorldAssetLoader is disposed');
    const root = new Group();
    root.name = `WorldProp:${kind}`;
    const fallback = this.fallback(kind).clone(true);
    root.add(fallback);
    let disposed = false;
    const spec = WORLD_ASSETS[kind];
    const instance: WorldPropInstance = {
      root,
      ready: spec.url === null ? Promise.resolve('fallback') : this.load(spec.url).then((template) => {
        if (disposed || this.disposed) return 'disposed';
        if (!template) return 'fallback';
        const model = clone(template);
        // glTF's coordinate system is already Y-up and metres. Uniform scaling
        // preserves aspect ratio; floor/centre the measured visible bounds.
        const bounds = new Box3().setFromObject(model);
        const size = bounds.getSize(new Vector3());
        if (!Number.isFinite(size.y) || size.y <= 0) return 'fallback';
        const container = new Group();
        container.add(model);
        const scale = spec.heightMetres / size.y;
        container.scale.setScalar(scale);
        container.position.set(-(bounds.min.x + bounds.max.x) * scale / 2,
          -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
        root.remove(fallback);
        root.add(container);
        root.updateMatrixWorld(true);
        return 'loaded';
      }),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        root.removeFromParent();
        root.clear();
        this.instances.delete(instance);
      },
    };
    this.instances.add(instance);
    return instance;
  }

  private load(url: string): Promise<Object3D | null> {
    let pending = this.cache.get(url);
    if (!pending) {
      pending = Promise.resolve().then(() => this.loadScene(url)).then((scene) => {
        if (this.disposed) {
          disposeResources([scene]);
          return null;
        }
        this.templates.add(scene);
        const size = new Box3().setFromObject(scene).getSize(new Vector3());
        if (![size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 0)) {
          throw new Error('Prop has empty or invalid bounds');
        }
        return scene;
      }).catch((error: unknown) => {
        if (!this.disposed) this.reportFailure(url, error);
        return null;
      });
      this.cache.set(url, pending);
    }
    return pending;
  }

  private fallback(kind: WorldPropKind): Object3D {
    const cached = this.fallbacks.get(kind);
    if (cached) return cached;
    const height = WORLD_ASSETS[kind].heightMetres;
    const root = new Group();
    const material = new MeshStandardMaterial({ color: kind === 'barrel' ? 0x536577 : 0x68543c, roughness: 0.85 });
    if (kind === 'industrial') {
      const geometry = new BoxGeometry(1.2, height / 3, 0.18);
      for (const z of [-0.4, -0.2, 0, 0.2, 0.4]) {
        const slat = new Mesh(geometry, material);
        slat.position.set(0, height * 5 / 6, z);
        root.add(slat);
      }
      const beamGeometry = new BoxGeometry(0.14, height * 2 / 3, 1);
      for (const x of [-0.45, 0, 0.45]) {
        const beam = new Mesh(beamGeometry, material);
        beam.position.set(x, height / 3, 0);
        root.add(beam);
      }
    } else {
      const mesh = new Mesh(kind === 'barrel'
        ? new CylinderGeometry(0.35, 0.35, height, 16)
        : new BoxGeometry(1, height, 1), material);
      mesh.position.y = height / 2;
      root.add(mesh);
    }
    this.fallbacks.set(kind, root);
    return root;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const instance of this.instances) instance.dispose();
    disposeResources([...this.templates, ...this.fallbacks.values()]);
    this.templates.clear();
    this.fallbacks.clear();
    this.cache.clear();
  }
}

function disposeResources(roots: Iterable<Object3D>): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  for (const root of roots) root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
