import * as THREE from "three";
const ANIMATED_LINE_TEXTURE_URL = "./assets/textures/line.png";

export class Utils {
    /**
     * Calculer la position (x,y,z) d'un Mesh à partir de sa géométrie
     * @param mesh 
     * @returns 
     */
     public static calculateMeshPosition(mesh:THREE.Mesh|THREE.Group) {
        const box = new THREE.Box3().setFromObject(mesh);
        const result = new THREE.Vector3()
        box.getCenter(result);
        return result;
    }


    /**
     * 
     * @param size 
     * @returns 
     */
    public static getDebugCube(position:THREE.Vector3, size=0.2) {
        const geometry = new THREE.BoxGeometry( size, size, size );
        const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        const cube = new THREE.Mesh( geometry, material );
        cube.position.set(...position.toArray())
        return cube
    }


    //https://codepen.io/josema/pen/bZJQog
    public static createAnimatedLine(   from:THREE.Vector3=new THREE.Vector3(0,0,0),
                                        to:THREE.Vector3=new THREE.Vector3(4,4,4), 
                                        lineWidth=0.5, lineHeight=0.06, repeatFactor=10) {
        if(!from) throw new Error(`Invalid value:`+from);
        if(!to) throw new Error(`Invalid value:`+to);
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(ANIMATED_LINE_TEXTURE_URL);
        const geometry = new THREE.PlaneBufferGeometry(lineWidth, lineHeight);
        const material = new THREE.MeshBasicMaterial({color: 0xffffff, map: texture});
        const mesh = new THREE.Mesh(geometry, material)
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.x = lineWidth / 2;
        const line = new THREE.Group()
        line.add(mesh)
        const detroyableTimer = setInterval(() => {
            texture.offset.x -= 0.20
        }, 50);

        const distance = from.distanceTo(to);
        const scaleFactorX = distance / mesh.geometry.parameters.width;
        line.position.set(...from.toArray());
        line.scale.set(scaleFactorX, 1, 1);
        texture.repeat.set(distance * repeatFactor, 1);
        line.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);


        return line;
    }

}
