import * as THREE from "three";
import { SVGResultPaths } from "three/examples/jsm/loaders/SVGLoader";

const DOT_PREFIX = "PATHFINDER_";

export interface PathFinderPoint {
    position:THREE.Vector3;
    mesh:THREE.Mesh;
    id: string;
    neighbors: any[]
}

export class SVG_PathFinder {

    private points : PathFinderPoint[] = [];

    constructor() {

    }

    public getPoints = () => this.points;

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
     * Add node in graph
     * @param mesh 
     */
    public addPoint(mesh:THREE.Mesh, path:SVGResultPaths) {
        const data = this.extractDataFromPath(path);
        const position = SVG_PathFinder.calculateMeshPosition(mesh);
        this.points.push({position, mesh, neighbors: data.neighbors, id: data.id});
    }

    /**
     * 
     * @param target 
     */
    public getNearestPointFrom(target:THREE.Vector3) : PathFinderPoint {
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

    /**
     * 
     */
    public static isPartOfPathFinder(path:SVGResultPaths) : boolean {
        const data = (path.userData as any).node;
        return data?.id && data.id.startsWith(DOT_PREFIX);
    }

    private graph : any = {}

    /**
     * Recalculate graph (edge : distances between nodes)
     */
    public calculateGraph() {
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

    public getGraph = () => this.graph; 

    /**
     * Calculer le chemin de points nécéssaires 
     * @param startingNodeId 
     * @param endNodeId 
     * @returns 
     */
    public getShortestPathBetween(startingNodeId:string, endNodeId:string) : THREE.Vector3[] {
        //  Calculate graph if necessary
        if(Object.keys(this.graph).length === 0) {
            this.calculateGraph();
        }
        //  Check Graph
        if(!this.graph || Object.keys(this.graph).length === 0)
            throw new Error(`Unable to find path in invalid graph.`);
        //  Check start/end nodes
        if(!this.graph.hasOwnProperty(startingNodeId)) throw new Error(`Missing node#${startingNodeId} in provided graph`);
        if(!this.graph.hasOwnProperty(endNodeId)) throw new Error(`Missing node#${endNodeId} in provided graph`);
        //  Calculate
        const path = Dijkstra.findShortestPath(this.graph, startingNodeId, endNodeId);
        //  Return Path
        return path.map((nodeId:string) => (this.points.find(p => p.id === nodeId) as PathFinderPoint).position);
    }

    /**
     * Calculer la position (x,y,z) d'un Mesh à partir de sa géométrie
     * @param mesh 
     * @returns 
     */
    public static calculateMeshPosition(mesh:THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const result = new THREE.Vector3()
        box.getCenter(result);
        return result;
    }

    /**
     * Calculer une courbe qui passe par un ensemble de points donné
     * @param points Tableau de points de dimension 3 (x,y,z)
     * @param color Couleur de la courbe
     * @returns 
     */
    public static getCurveFromPoints(points: THREE.Vector3[], color:number=0xff0000) {
        const curve = new THREE.CatmullRomCurve3( points );
        const geometry = new THREE.BufferGeometry().setFromPoints( curve.getPoints( 50 ) );
        const material = new THREE.LineBasicMaterial( { color } );
        return new THREE.Line( geometry, material );
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