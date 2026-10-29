import {
  CatmullRomCurve3,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { EnemyBase } from './EnemyBase';

const HOVER_HEIGHT = 1.7;

/** A floating, carved pumpkin that uses the same damage and combat rules as a zombie. */
export class FlyingPumpkin extends EnemyBase {
  private readonly leftWing = new Group();
  private readonly rightWing = new Group();
  private readonly leftVine = new Group();
  private readonly rightVine = new Group();
  private readonly phaseOffset: number;
  private elapsedSeconds = 0;

  constructor(id: string) {
    super(id);
    this.phaseOffset = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) * 0.11;
    this.root.position.y = HOVER_HEIGHT;
    this.root.add(this.leftWing, this.rightWing, this.leftVine, this.rightVine);
    this.buildBody();
  }

  spawnAt(position: Vector3): void {
    this.root.position.copy(position);
    this.root.position.y = HOVER_HEIGHT;
  }

  override update(dtSeconds: number): void {
    if (!this.isAlive) {
      super.update(dtSeconds);
      return;
    }
    this.elapsedSeconds += Math.max(0, dtSeconds);
    const phase = this.elapsedSeconds * 3.1 + this.phaseOffset;
    this.root.position.y = HOVER_HEIGHT + Math.sin(phase) * 0.18;
    this.root.rotation.x = Math.sin(phase * 0.53) * 0.045;
    this.root.rotation.z = Math.sin(phase * 0.77) * 0.06;
    this.leftWing.rotation.z = -0.12 - Math.sin(phase * 7) * 0.43;
    this.rightWing.rotation.z = 0.12 + Math.sin(phase * 7 + 0.5) * 0.43;
    this.leftVine.rotation.z = Math.sin(phase * 1.7) * 0.12;
    this.rightVine.rotation.z = -Math.sin(phase * 1.5 + 0.8) * 0.12;
  }

  private buildBody(): void {
    const surface = this.createSurfaceBump(0x109a, 96);
    const flesh = this.ownMaterial(new MeshStandardMaterial({
      color: 0xc95a1b, roughness: 0.79, bumpMap: surface, bumpScale: 0.035,
    }));
    const ridge = this.ownMaterial(new MeshStandardMaterial({ color: 0x8d3515, roughness: 0.9 }));
    const cut = this.ownMaterial(new MeshStandardMaterial({ color: 0x20130e, roughness: 0.92 }));
    const glow = this.ownMaterial(new MeshStandardMaterial({
      color: 0xffaa30, emissive: 0xff4c0a, emissiveIntensity: 1.45, roughness: 0.24,
    }));
    const stem = this.ownMaterial(new MeshStandardMaterial({ color: 0x46512a, roughness: 0.96, bumpMap: surface, bumpScale: 0.03 }));
    const leaf = this.ownMaterial(new MeshStandardMaterial({ color: 0x59602c, roughness: 0.94, side: DoubleSide }));
    const tooth = this.ownMaterial(new MeshStandardMaterial({ color: 0xd6b568, roughness: 0.76 }));

    const shell = this.ownGeometry(new SphereGeometry(1, 48, 32));
    const vertices = shell.attributes.position;
    for (let index = 0; index < vertices.count; index += 1) {
      const x = vertices.getX(index);
      const y = vertices.getY(index);
      const z = vertices.getZ(index);
      const angle = Math.atan2(z, x);
      const lobe = 1 + Math.cos(angle * 9) * Math.sqrt(Math.max(0, 1 - y * y)) * 0.065;
      vertices.setX(index, x * lobe);
      vertices.setZ(index, z * lobe);
    }
    shell.computeVertexNormals();
    this.addMesh(this.root, shell, flesh, 0, 0, 0, 0.66, 0.61, 0.58);

    // Subtle dark seams follow the pumpkin's natural lobes.
    for (let lobeIndex = 0; lobeIndex < 9; lobeIndex += 1) {
      const angle = lobeIndex * Math.PI * 2 / 9;
      const points: Vector3[] = [];
      for (let segment = 0; segment <= 12; segment += 1) {
        const latitude = -1.24 + segment * 2.48 / 12;
        const ring = Math.cos(latitude);
        const swell = 1 + Math.cos(angle * 9) * ring * 0.065;
        points.push(new Vector3(
          Math.cos(angle) * ring * swell * 0.663,
          Math.sin(latitude) * 0.614,
          Math.sin(angle) * ring * swell * 0.583,
        ));
      }
      const groove = this.ownGeometry(new TubeGeometry(new CatmullRomCurve3(points), 16, 0.009, 5, false));
      this.addMesh(this.root, groove, ridge);
    }

    // Carved triangles, ember eyes and a saw-toothed grin face forward (+Z).
    this.addFacePolygon(cut, [
      [-0.39, 0.13], [-0.14, 0.34], [-0.11, 0.035], [-0.25, -0.015],
    ]);
    this.addFacePolygon(cut, [
      [0.11, 0.035], [0.14, 0.34], [0.39, 0.13], [0.25, -0.015],
    ]);
    const eye = this.ownGeometry(new SphereGeometry(0.052, 12, 10));
    this.addMesh(this.root, eye, glow, -0.23, 0.145, 0.535, 1, 1.05, 0.72);
    this.addMesh(this.root, eye, glow, 0.23, 0.145, 0.535, 1, 1.05, 0.72);
    this.addFacePolygon(cut, [
      [-0.39, -0.19], [-0.28, -0.17], [-0.19, -0.25], [-0.1, -0.18],
      [0, -0.28], [0.1, -0.18], [0.2, -0.25], [0.29, -0.17], [0.39, -0.19],
      [0.32, -0.42], [0.18, -0.37], [0.09, -0.44], [0, -0.38], [-0.1, -0.44],
      [-0.2, -0.37], [-0.33, -0.43],
    ]);
    for (let index = 0; index < 6; index += 1) {
      const x = -0.25 + index * 0.1;
      const points: [number, number][] = index % 2 === 0
        ? [[x, -0.19], [x + 0.055, -0.2], [x + 0.025, -0.285]]
        : [[x, -0.39], [x + 0.055, -0.38], [x + 0.03, -0.305]];
      this.addFacePolygon(tooth, points, 0.012);
    }

    const stemGeometry = this.ownGeometry(new TubeGeometry(new CatmullRomCurve3([
      new Vector3(0, 0.57, 0), new Vector3(0.015, 0.69, 0),
      new Vector3(0.08, 0.78, 0.005), new Vector3(0.12, 0.85, 0.015),
    ]), 12, 0.065, 8, false));
    this.addMesh(this.root, stemGeometry, stem);
    const leafMesh = this.addPolygon(this.root, leaf, [[0, 0], [0.2, 0.08], [0.39, 0.02], [0.22, -0.025], [0.1, -0.12]], 0);
    leafMesh.position.set(0.035, 0.73, -0.005);
    leafMesh.rotation.z = -0.4;

    this.buildWing(this.leftWing, leaf, -1);
    this.buildWing(this.rightWing, leaf, 1);
    this.buildVine(this.leftVine, stem, -1);
    this.buildVine(this.rightVine, stem, 1);
    this.consolidateMeshes();
  }

  private buildWing(parent: Group, material: MeshStandardMaterial, side: -1 | 1): void {
    const points: [number, number][] = side < 0
      ? [[0, 0], [-0.2, 0.18], [-0.49, 0.24], [-0.36, 0.05], [-0.58, -0.09], [-0.31, -0.1], [-0.43, -0.28], [-0.12, -0.19]]
      : [[0, 0], [0.2, 0.18], [0.49, 0.24], [0.36, 0.05], [0.58, -0.09], [0.31, -0.1], [0.43, -0.28], [0.12, -0.19]];
    const shape = new Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
    shape.closePath();
    const geometry = this.ownGeometry(new ShapeGeometry(shape));
    parent.position.set(side * 0.53, 0.035, -0.08);
    this.addMesh(parent, geometry, material);
  }

  private buildVine(parent: Group, material: MeshStandardMaterial, side: -1 | 1): void {
    parent.position.set(side * 0.52, -0.12, -0.1);
    const curve = new CatmullRomCurve3([
      new Vector3(0, 0, 0),
      new Vector3(side * 0.25, 0.08, -0.02),
      new Vector3(side * 0.39, 0.26, -0.03),
      new Vector3(side * 0.3, 0.46, 0.02),
      new Vector3(side * 0.5, 0.52, 0.06),
    ]);
    const geometry = this.ownGeometry(new TubeGeometry(curve, 22, 0.027, 6, false));
    this.addMesh(parent, geometry, material);
    const thorn = this.ownGeometry(new ConeGeometry(0.045, 0.16, 6));
    const spike = this.addMesh(parent, thorn, material, side * 0.34, 0.28, -0.015, 0.7, 1, 0.7);
    spike.rotation.z = side * -0.7;
  }

  private addPolygon(
    parent: Group,
    material: MeshStandardMaterial,
    points: readonly [number, number][],
    z: number,
  ): Mesh {
    const shape = new Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
    shape.closePath();
    return this.addMesh(parent, this.ownGeometry(new ShapeGeometry(shape)), material, 0, 0, z);
  }

  private addFacePolygon(
    material: MeshStandardMaterial,
    points: readonly [number, number][],
    surfaceOffset = 0.008,
  ): Mesh {
    const shape = new Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
    shape.closePath();
    const geometry = this.ownGeometry(new ShapeGeometry(shape));
    const vertices = geometry.attributes.position;
    for (let index = 0; index < vertices.count; index += 1) {
      const x = vertices.getX(index);
      const y = vertices.getY(index);
      const normalizedX = x / 0.66;
      const normalizedY = y / 0.61;
      const radial = Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX - normalizedY * normalizedY));
      const angle = Math.atan2(normalizedX, radial);
      const lobe = 1 + Math.cos(angle * 9) * radial * 0.065;
      vertices.setZ(index, radial * lobe * 0.58 + surfaceOffset);
    }
    geometry.computeVertexNormals();
    return this.addMesh(this.root, geometry, material);
  }
}
