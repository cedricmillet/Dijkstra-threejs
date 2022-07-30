import * as THREE from "three";
import { SVGResultPaths } from "three/examples/jsm/loaders/SVGLoader";
import { Dijkstra } from "./Dijkstra";
import { Utils } from "./Utils";

const DOT_PREFIX = "PATHFINDER_";


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
        mesh.visible = false;
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

    public getPathFrom(origin:THREE.Vector3, mode:'spline'|'line'='line') {
        const sourcePoint = this.getNearestPointFrom(origin);
        const destinationPoint = this.points[2];
        if(destinationPoint.id === sourcePoint.id) {
            console.warn(`same source/destination point`);
            return null;
        }
        const path = this.getShortestPathBetween(sourcePoint, destinationPoint);

        const group = new THREE.Group();
        if(mode === 'spline') {
            const curve = SVG_PathFinder.getCurveFromPoints(path);
            group.add(curve)
        } else {
            for(let i=0;i<path.length;i++) {
                const current = path[i];
                const next = path[i+1];
                if(current && next) {
                    const line = Utils.createAnimatedLine(current, next)
                    group.add(line)
                }
            }

        }
        return group;
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
}
