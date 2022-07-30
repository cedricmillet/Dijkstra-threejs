import * as THREE from "three";
import { SVGResultPaths } from "three/examples/jsm/loaders/SVGLoader";

const DOT_PREFIX = "PATHFINDER_";
const ANIMATED_LINE_TEXTURE_URL = "./assets/textures/line.png";

export interface PathFinderPoint {
    position:THREE.Vector3;
    mesh:THREE.Mesh;
    id: string;
    neighbors: any[]
}

export class SVG_PathFinder {

    //  Provided nodes & neighbors
    private points : PathFinderPoint[] = [];

    //  Dynamically calculated
    private graph : any = {}

    constructor() {}

    /*****************************************************************************
     *                      PUBLIC
    /*****************************************************************************/

    /**
     * Add node in our path finder system
     * @param mesh 
     */
    public addPoint(mesh:THREE.Mesh, path:SVGResultPaths) {
        //  Check mesh validity
        if(!mesh.name) {
            throw new Error(`Please provide a name to this mesh.`)
        }
        //  Check mesh unicity
        if(this.points.map(p=>p.id).includes(mesh.name)) {
            throw new Error(`Please provide an UNIQUE name, '${mesh.name}' already added.`);
        }
        //  Extract svg attributes from SVGResultPaths
        const data = this.extractDataFromPath(path);
        //  Add
        this.points.push({position: new THREE.Vector3(), mesh, neighbors: data.neighbors, id: data.id});
    }

    /**
     * Find closest SVG Point from a given (x,y,z) world position
     * @param target 
     */
    public getNearestPointFrom(target:THREE.Vector3) {
        if(this.points.length===0) throw new Error("Empty point array");
        let nearest = this.points[0];
        let nearestDist = this.points[0].position.distanceTo(target);
        for(let point of this.points) {
            const distance = point.position.distanceTo(target);
            if(distance < nearestDist) {
                nearestDist = distance;
                nearest = point;
            }
        }
        return nearest;
    }

    public getPathFrom(origin:THREE.Vector3) {
        const sourcePoint = this.getNearestPointFrom(origin);
        const destinationPoint = this.points[0];
        if(destinationPoint.id === sourcePoint.id) {
            console.warn(`same source/destination point`);
            return null;
        }
        const path = this.getShortestPathBetween(sourcePoint, destinationPoint);
        const curve = SVG_PathFinder.getCurveFromPoints(path);
        return curve;
    }

    /**
     * Recalculate graph (edge : distances between nodes)
     */
     public calculateGraph() {
        //  Update mesh position field
        for(let p of this.points)
            p.position = Utils.calculateMeshPosition(p.mesh);
        //  Calculate graph
        this.graph = {} as any;
        for(let point of this.points) {
            let neighbors = {} as any;
            for(let neighborId of point.neighbors) {
                const neighbor = this.points.find(p=>p.id===neighborId)
                if(!neighbor) throw new Error(`Unable to find neighbor#${neighborId}`);
                neighbors[neighborId] = point.position.distanceTo(neighbor.position)
            }
            this.graph[point.id] = neighbors;
        }
    }

    /**
     * Is graph already calculated ?
     * @returns boolean
     */
    public graphCalculated = () : boolean => Object.keys(this.graph).length>0;


    /**
     * Is provided path a part of svg pathfinder system ?
     * @param path SVGResultPaths returned by SVGLoader
     * @returns boolean
     */
    public static isPartOfPathFinder(path:SVGResultPaths) : boolean {
        const data = (path.userData as any).node;
        return data?.id && data.id.startsWith(DOT_PREFIX);
    }

    /*****************************************************************************
     *                      PRIVATE
    /*****************************************************************************/


    private extractDataFromPath(path:SVGResultPaths) {
        if(!path.userData || !(path.userData as any)?.node?.id)
            throw new Error("Unable to retrieve id in path...");
        
        const id = (path.userData as any).node.id as string
        if(!id.startsWith(DOT_PREFIX)) throw new Error("id must starts with DOT_PREFIX" + id);
        
        const chain = id.substring(DOT_PREFIX.length).split('__');
        return {
            id: chain[0],
            neighbors: chain[1].split('-')
        }
    }


    /**
     * Calculer le chemin de points nécéssaires 
     * @param startingNodeId 
     * @param endNodeId 
     * @returns 
     */
    private getShortestPathBetween(startingNode:PathFinderPoint, endNode:PathFinderPoint) : THREE.Vector3[] {
        //  Calculate graph if necessary
        if(Object.keys(this.graph).length === 0) {
            throw new Error(`Please call calculateGraph() before`)
        }
        //  Check Graph
        if(!this.graph || Object.keys(this.graph).length === 0)
            throw new Error(`Unable to find path in invalid graph.`);
        //  Check start/end nodes
        if(!this.graph.hasOwnProperty(startingNode.id)) throw new Error(`Missing node#${startingNode.id} in provided graph`);
        if(!this.graph.hasOwnProperty(endNode.id)) throw new Error(`Missing node#${endNode.id} in provided graph`);
        //  Calculate
        const path = Dijkstra.findShortestPath(this.graph, startingNode.id, endNode.id);
        //  Return Path
        return path.map((nodeId:string) => (this.points.find(p => p.id === nodeId) as PathFinderPoint).position);
    }

    /**
     * Calculer une courbe qui passe par un ensemble de points donnés
     * @param points Tableau de points de dimension 3 (x,y,z)
     * @param color Couleur de la courbe
     * @returns 
     */
    private static getCurveFromPoints(points: THREE.Vector3[], color:number=0xff0000) {
        const curve = new THREE.CatmullRomCurve3( points );
        const geometry = new THREE.BufferGeometry().setFromPoints( curve.getPoints( 50 ) );
        const material = new THREE.LineBasicMaterial( { color } );
        return new THREE.Line( geometry, material );
    }



    //https://codepen.io/josema/pen/bZJQog
    private static createAnimatedLine(   from:THREE.Vector3=new THREE.Vector3(0,0,0),
                                        to:THREE.Vector3=new THREE.Vector3(4,4,4), 
                                        lineWidth=0.5, lineHeight=0.06, repeatFactor=10) {
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

}

class Dijkstra {
    
    private static shortestDistanceNode = (distances:any, visited:any) => {
        let shortest = null;
        for (let node in distances) {
            let currentIsShortest =
                shortest === null || distances[node] < distances[shortest];
            if (currentIsShortest && !visited.includes(node)) {
                shortest = node;
            }
        }
        return shortest;
    };

    public static findShortestPath = (graph:any, startNode:string, endNode:string) => {
        // establish object for recording distances from the start node
        let distances:any = {};
        distances[endNode] = "Infinity";
        distances = Object.assign(distances, graph[startNode]);

        // track paths
        let parents:any = { endNode: null };
        for (let child in graph[startNode]) {
            parents[child] = startNode;
        }

        // track nodes that have already been visited
        let visited :any[] = [];

        // find the nearest node
        let node = this.shortestDistanceNode(distances, visited);

        // for that node
        while (node) {
            // find its distance from the start node & its child nodes
            let distance = distances[node];
            let children = graph[node];
            // for each of those child nodes
            for (let child in children) {
                // make sure each child node is not the start node
                if (String(child) === String(startNode)) {
                    continue;
                } else {
                    // save the distance from the start node to the child node
                    let newdistance = distance + children[child];
                    // if there's no recorded distance from the start node to the child node in the distances object
                    // or if the recorded distance is shorter than the previously stored distance from the start node to the child node
                    // save the distance to the object
                    // record the path
                    if (!distances[child] || distances[child] > newdistance) {
                        distances[child] = newdistance;
                        parents[child] = node;
                    }
                }
            }
            // move the node to the visited set
            visited.push(node);
            // move to the nearest neighbor node
            node = this.shortestDistanceNode(distances, visited);
        }

        // using the stored paths from start node to end node
        // record the shortest path
        let shortestPath = [endNode];
        let parent = parents[endNode];
        while (parent) {
            shortestPath.push(parent);
            parent = parents[parent];
        }
        shortestPath.reverse();

        // return the shortest path from start node to end node & its distance
        /*
        let results = {
            distance: distances[endNode],
            path: shortestPath,
        };*/

        return shortestPath;
    };



}