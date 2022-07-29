import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {SVGLoader, SVGResult} from 'three/examples/jsm/loaders/SVGLoader';
import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { SVG_PathFinder } from './SVG_PathFinder';
import { Box3 } from 'three';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;

  renderer = new THREE.WebGLRenderer({antialias: true});
  scene:THREE.Scene;
  camera:THREE.Camera;
  controls:OrbitControls;
  pathFinder:SVG_PathFinder = new SVG_PathFinder();

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null as any;
    this.controls = null as any;
  }

  ngAfterViewInit(): void {
    const [w,h] = this.getSize();
    //  Renderer
    this.renderer.setSize(w, h);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color( 0xffffff );
    //  Light
    this.scene.add(new THREE.DirectionalLight(0xffffff, 0.5));
    this.scene.add(new THREE.AmbientLight(0x404040));
    //  Helpers
    this.scene.add(new THREE.GridHelper(20, 10));
    this.scene.add(new THREE.AxesHelper(10));
    //  Camera
    this.camera = new THREE.PerspectiveCamera(75, w/h, 1, 1000);
    this.camera.position.set(5,10,5);
    this.camera.lookAt(0,0,0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.loadSVG();
    //  Run !
    this.animate();
    this.scene.add(SVG_PathFinder.createAnimatedLine())
  }

  ngOnInit(): void {}

  private animate() {
    window.requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera as THREE.Camera);
  }


  private getSize() {
    const e = this.rendererContainer.nativeElement as HTMLElement;
    return [e.offsetWidth, e.offsetHeight]
  }

  private loadSVG() {
    const that = this;
    const loader = new SVGLoader();
    loader.load( `assets/img.svg`, function (data:SVGResult) {
      const paths = data.paths;
      const group = new THREE.Group();
      for(let path of paths) {
        const shapes = SVGLoader.createShapes(path);
        const geometry = new THREE.ExtrudeGeometry(shapes, {steps:1, depth:-5});
        const material = new THREE.MeshPhongMaterial({color: new THREE.Color(path.color), side: THREE.DoubleSide});
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        if(SVG_PathFinder.isPartOfPathFinder(path)) {
          that.pathFinder.addPoint(mesh, path);
        }
      }

      that.applyCommonTransformation(group);
      
      //group.translateOnAxis(new THREE.Vector3(1,1,0), 0)
      that.scene.add(group);
      
      const itinerary = that.pathFinder.getShortestPathBetween("A", "F")
      const curve = SVG_PathFinder.getCurveFromPoints(itinerary);
      that.applyCommonTransformation(curve);
      that.scene.add(curve);

    }, function(xhr:any) {
      console.log("loaded : ", xhr.loaded/xhr.total*100, "%");
    }, function(err) {
      console.error(err);
    })
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event : any) {
    this.renderer.setScissor(event.target.innerWidth, event.target.innerHeight);
  }

  //  Transformer l'échelle et la position pour aligner les objets sur la grille
  private applyCommonTransformation(obj:THREE.Group|THREE.Object3D) {
    obj.rotateX(Math.PI/2);
    const s = 0.05;
    obj.scale.set(s,s,s)
  }
}

