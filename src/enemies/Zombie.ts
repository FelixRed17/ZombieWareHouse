import {
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { EnemyBase } from './EnemyBase';

/** A hunched, scarred humanoid with owned procedural geometry and materials. */
export class Zombie extends EnemyBase {
  private readonly body = new Group();
  private readonly leftArm = new Group();
  private readonly rightArm = new Group();
  private elapsedSeconds = 0;

  constructor(id: string) {
    super(id);
    this.root.position.y = 0;
    this.root.add(this.body);
    this.buildBody();
  }

  override update(dtSeconds: number): void {
    if (!this.isAlive) {
      super.update(dtSeconds);
      return;
    }
    this.elapsedSeconds += Math.max(0, dtSeconds);
    const gait = this.elapsedSeconds * 4.2;
    this.body.rotation.x = -0.11 + Math.sin(gait * 0.5) * 0.018;
    this.body.rotation.z = Math.sin(gait * 0.7) * 0.018;
    this.leftArm.rotation.x = -0.16 + Math.sin(gait) * 0.08;
    this.rightArm.rotation.x = 0.28 - Math.sin(gait) * 0.05;
  }

  private buildBody(): void {
    const skinTexture = this.createSurfaceBump(0x5a17);
    const clothTexture = this.createSurfaceBump(0x2f91);
    const skin = this.ownMaterial(new MeshStandardMaterial({
      color: 0x70775c, roughness: 0.92, bumpMap: skinTexture, bumpScale: 0.035,
    }));
    const bruisedSkin = this.ownMaterial(new MeshStandardMaterial({
      color: 0x51493e, roughness: 0.96, bumpMap: skinTexture, bumpScale: 0.04,
    }));
    const coat = this.ownMaterial(new MeshStandardMaterial({
      color: 0x27343a, roughness: 0.98, bumpMap: clothTexture, bumpScale: 0.055,
    }));
    const tornCloth = this.ownMaterial(new MeshStandardMaterial({
      color: 0x493b32, roughness: 1, bumpMap: clothTexture, bumpScale: 0.06,
    }));
    const pants = this.ownMaterial(new MeshStandardMaterial({
      color: 0x252d32, roughness: 0.98, bumpMap: clothTexture, bumpScale: 0.06,
    }));
    const mouth = this.ownMaterial(new MeshStandardMaterial({ color: 0x17100f, roughness: 1 }));
    const wound = this.ownMaterial(new MeshStandardMaterial({ color: 0x39211c, roughness: 0.86 }));
    const blood = this.ownMaterial(new MeshStandardMaterial({ color: 0x54221d, roughness: 0.68 }));
    const bone = this.ownMaterial(new MeshStandardMaterial({ color: 0xbab08e, roughness: 0.82 }));
    const eyeSocket = this.ownMaterial(new MeshStandardMaterial({ color: 0x201c19, roughness: 1 }));
    const cloudedEye = this.ownMaterial(new MeshStandardMaterial({ color: 0xb3b295, roughness: 0.34 }));
    const emberEye = this.ownMaterial(new MeshStandardMaterial({
      color: 0xb34b23, emissive: 0x6a1808, emissiveIntensity: 0.8, roughness: 0.26,
    }));

    const torso = this.ownGeometry(new CapsuleGeometry(0.32, 0.58, 5, 16));
    const head = this.ownGeometry(new SphereGeometry(0.28, 24, 18));
    const jaw = this.ownGeometry(new SphereGeometry(0.21, 16, 12));
    const neck = this.ownGeometry(new CylinderGeometry(0.14, 0.19, 0.27, 12));
    const upperArm = this.ownGeometry(new CapsuleGeometry(0.125, 0.39, 4, 12));
    const forearm = this.ownGeometry(new CapsuleGeometry(0.095, 0.34, 4, 12));
    const thigh = this.ownGeometry(new CapsuleGeometry(0.145, 0.34, 4, 12));
    const shin = this.ownGeometry(new CapsuleGeometry(0.105, 0.37, 4, 12));
    const hand = this.ownGeometry(new SphereGeometry(0.12, 12, 8));
    const socket = this.ownGeometry(new SphereGeometry(0.086, 12, 10));
    const eye = this.ownGeometry(new SphereGeometry(0.046, 12, 10));
    const tooth = this.ownGeometry(new ConeGeometry(0.026, 0.085, 7));
    const finger = this.ownGeometry(new CapsuleGeometry(0.025, 0.12, 3, 8));
    const shard = this.ownGeometry(new ConeGeometry(0.055, 0.22, 7));

    this.addMesh(this.body, torso, bruisedSkin, 0, 1.22, -0.005, 1, 1, 0.82);
    this.addMesh(this.body, neck, skin, 0, 1.72, 0.01);
    this.addMesh(this.body, head, skin, -0.025, 1.99, 0.015, 0.94, 1.16, 0.91);
    this.addMesh(this.body, jaw, bruisedSkin, 0.015, 1.73, 0.095, 0.95, 0.66, 0.86);
    const nose = this.addMesh(this.body, this.ownGeometry(new ConeGeometry(0.075, 0.19, 9)), bruisedSkin, 0, 1.875, 0.265);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI;

    // Deep, mismatched sockets and mismatched eyes make the face read clearly at a distance.
    for (const side of [-1, 1]) {
      this.addMesh(this.body, socket, eyeSocket, side * 0.115, 2.01, 0.231, 1, 1.15, 0.64);
    }
    this.addMesh(this.body, eye, emberEye, -0.12, 2.015, 0.285, 0.95, 0.9, 0.9);
    this.addMesh(this.body, eye, cloudedEye, 0.11, 2.005, 0.286, 0.76, 0.72, 0.8);
    this.addPolygon(this.body, mouth, [
      [-0.19, 1.81], [-0.11, 1.85], [-0.04, 1.79], [0.04, 1.83], [0.13, 1.78],
      [0.19, 1.82], [0.16, 1.68], [0.08, 1.65], [0.01, 1.7], [-0.07, 1.64], [-0.16, 1.69],
    ], 0.277);
    for (const x of [-0.13, -0.065, 0.01, 0.085, 0.145]) {
      const toothMesh = this.addMesh(this.body, tooth, bone, x, x > 0.1 ? 1.782 : 1.777, 0.291, 0.8, 0.72, 0.8);
      toothMesh.rotation.z = x * 1.4;
    }
    this.addMesh(this.body, this.ownGeometry(new SphereGeometry(0.09, 10, 8)), wound, -0.205, 1.91, 0.204, 0.78, 0.66, 0.34);
    this.addMesh(this.body, this.ownGeometry(new SphereGeometry(0.044, 8, 6)), blood, -0.22, 1.93, 0.236, 0.7, 1, 0.45);
    this.addMesh(this.body, this.ownGeometry(new SphereGeometry(0.13, 10, 8)), skin, -0.30, 1.99, 0, 0.72, 1, 0.72);

    // Open, torn coat panels expose irregular ribs and bruised skin underneath.
    this.addPolygon(this.body, tornCloth, [
      [-0.31, 1.58], [-0.08, 1.53], [-0.12, 1.37], [-0.04, 1.21],
      [-0.16, 1.11], [-0.11, 0.92], [-0.25, 0.99], [-0.34, 1.18],
    ], 0.305);
    this.addPolygon(this.body, coat, [
      [0.31, 1.58], [0.11, 1.51], [0.16, 1.34], [0.05, 1.21],
      [0.18, 1.12], [0.12, 0.98], [0.29, 1.05], [0.35, 1.28],
    ], 0.305);
    this.addPolygon(this.body, tornCloth, [
      [-0.28, 1.02], [-0.12, 1.08], [-0.19, 0.88], [-0.12, 0.75],
      [-0.25, 0.81], [-0.33, 0.67], [-0.36, 0.9],
    ], 0.25);
    this.addPolygon(this.body, coat, [
      [0.15, 1.05], [0.3, 1.11], [0.28, 0.91], [0.37, 0.77],
      [0.2, 0.81], [0.1, 0.69], [0.08, 0.91],
    ], 0.25);

    for (let rib = 0; rib < 4; rib += 1) {
      const y = 1.37 - rib * 0.095;
      const curve = new CatmullRomCurve3([
        new Vector3(-0.045, y, 0.275),
        new Vector3(0.015, y - 0.025, 0.305),
        new Vector3(0.085, y - 0.075, 0.29),
        new Vector3(0.13, y - 0.13, 0.255),
      ]);
      const ribGeometry = this.ownGeometry(new TubeGeometry(curve, 12, 0.022, 6, false));
      this.addMesh(this.body, ribGeometry, bone);
    }
    this.addPolygon(this.body, wound, [
      [-0.055, 1.4], [0.02, 1.46], [0.08, 1.39], [0.14, 1.42],
      [0.12, 1.29], [0.04, 1.25], [-0.015, 1.32],
    ], 0.325);
    this.addMesh(this.body, this.ownGeometry(new SphereGeometry(0.045, 8, 6)), blood, 0.05, 1.36, 0.34, 1, 1.4, 0.45);

    // One shoulder is exposed; the other hangs inside a ragged coat sleeve.
    this.body.add(this.leftArm);
    this.body.add(this.rightArm);
    this.leftArm.position.set(-0.38, 1.47, 0.01);
    this.rightArm.position.set(0.38, 1.47, 0.01);
    this.addMesh(this.leftArm, upperArm, skin, -0.015, -0.31, 0.015, 0.94, 1, 0.88);
    this.addMesh(this.leftArm, forearm, bruisedSkin, -0.025, -0.72, 0.08, 1, 1.05, 0.92);
    this.addMesh(this.rightArm, upperArm, coat, 0.015, -0.31, 0, 1.04, 1, 1);
    this.addMesh(this.rightArm, forearm, skin, 0.025, -0.72, 0.035, 0.94, 1.1, 0.9);
    this.addMesh(this.leftArm, this.ownGeometry(new SphereGeometry(0.135, 10, 8)), wound, -0.03, -0.48, 0.078, 0.72, 1.1, 0.4);
    this.addMesh(this.leftArm, shard, bone, -0.01, -0.51, 0.1, 0.42, 0.55, 0.42).rotation.z = 0.4;
    this.addClawedHand(this.leftArm, hand, finger, skin, -0.025, -0.92, 0.09);
    this.addClawedHand(this.rightArm, hand, finger, bruisedSkin, 0.025, -0.92, 0.04);

    const legPivots = [-1, 1].map((side) => {
      const pivot = new Group();
      pivot.position.set(side * 0.17, 0.72, 0);
      this.body.add(pivot);
      return pivot;
    });
    this.addMesh(legPivots[0], thigh, pants, 0, -0.23, 0, 0.92, 1, 0.92);
    this.addMesh(legPivots[0], shin, bruisedSkin, -0.01, -0.62, 0.025, 0.78, 1, 0.85);
    this.addMesh(legPivots[1], thigh, pants, 0, -0.23, 0, 1.04, 1, 1);
    this.addMesh(legPivots[1], shin, pants, 0.015, -0.61, 0, 0.9, 1.05, 0.9);
    this.addMesh(legPivots[0], this.ownGeometry(new SphereGeometry(0.105, 10, 8)), wound, 0, -0.48, 0.093, 0.7, 1.1, 0.42);
    this.addMesh(legPivots[0], shard, bone, 0.025, -0.5, 0.13, 0.38, 0.72, 0.38).rotation.z = -0.35;
    this.addMesh(this.body, this.ownGeometry(new BoxGeometry(0.22, 0.13, 0.42)), bruisedSkin, -0.18, 0.045, 0.09, 1, 1, 1.05);
    this.addMesh(this.body, this.ownGeometry(new BoxGeometry(0.23, 0.13, 0.4)), bruisedSkin, 0.18, 0.045, 0.09, 1, 0.8, 1);
    this.consolidateMeshes();
  }

  private addClawedHand(
    parent: Group,
    handGeometry: SphereGeometry,
    fingerGeometry: CapsuleGeometry,
    material: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ): void {
    this.addMesh(parent, handGeometry, material, x, y, z, 1.15, 0.85, 0.9);
    for (let finger = 0; finger < 4; finger += 1) {
      const offset = (finger - 1.5) * 0.055;
      const claw = this.addMesh(parent, fingerGeometry, material, x + offset, y - 0.12, z + 0.055, 0.8, 1, 0.8);
      claw.rotation.z = (finger - 1.5) * -0.12;
    }
  }

  private addPolygon(parent: Group, material: MeshStandardMaterial, points: readonly [number, number][], z: number): void {
    const shape = new Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
    shape.closePath();
    const geometry = this.ownGeometry(new ShapeGeometry(shape));
    this.addMesh(parent, geometry, material, 0, 0, z);
  }
}
