import * as PIXI from 'pixi.js';
import { rotatePoint } from '@/core/functions';
import { gatheredAssets, HitboxParameters, MaskParameters } from '@/core/asset_loader';

import { Msg } from '@/editable';
import type { SpriteStorage } from '@/sprites/storage';
import { m } from '@/core/sensing_properties';

export { SmoothText } from '@/core/screen';
export type { MaskParameters, HitboxParameters } from "@/core/asset_loader";


/** The SVG sprite image will always remain smooth at any screen zoom. */
export class Sprite extends PIXI.Sprite implements PIXI.ContainerChild {
    /**
     * A sprite texture can be either a bitmap or a vector image loaded to gatheredAssets.textures
     */
    textureKey!: string;

    constructor(key="") {
        super();
        // give a texture to a sprite by key
        this.changeTextureKey(key);

        // default parameters for all sprites
        {
            this.anchor.set(0.5);
        }
    }

    changeTextureKey(key: string) {
        if (gatheredAssets.textures[key] && key!=="") {
            this.texture = gatheredAssets.textures[key];
        }
        else {
            if (key!=="") {
                console.warn(`Cannot find the texture key: ${key}`);
            }
            this.texture = PIXI.Texture.EMPTY;
        }
        this.textureKey = key;
    }

    changeTextureKeyTick(key: string) {
        if (key!==this.textureKey) {
            this.changeTextureKey(key);
        }
    }
}

export interface TopLogicObject<T extends TopLogicObject<any> = any> extends PIXI.ContainerChild {
    new: boolean;
    /** Whether this object can receive messages. This does not affect visibility.
     * If this property is `false`, the object must be accessed directly. */
    enabled: boolean;
    enable: ()=>void;
    disable: ()=>void;

    delete: boolean;
    deleteOptionsH?: PIXI.DestroyOptions;
    belongsToPool: ObjectPool<T>|null;
    master: TopLogicObject|null;

    /**
     * Handles the message process.
     * @example 
     * ```
     * messageStep(message: Msg, s: SpriteStorage): void {
     *     switch (message) {
     *         case Msg.TICK:
     *             ...
     *             break;
     *     }
     * }
     * ```
     */
    messageStep(message: Msg, s: SpriteStorage): void;
}

export class TopSprite extends Sprite implements TopLogicObject, PIXI.ContainerChild {
    new = true;
    enabled = true;
    enable() {this.enabled = true; this.visible = true;}
    disable() {this.enabled = false; this.visible = false;}

    delete = false;
    deleteOptionsH?: PIXI.DestroyOptions;
    belongsToPool: ObjectPool<TopSprite>|null = null;
    master: TopLogicObject|null = null;

    messageStep(message: Msg, s: SpriteStorage) {}
}

/** A container with independent objects */
export class TopContainer extends PIXI.Container implements TopLogicObject, PIXI.ContainerChild {
    new = true;
    enabled = true;
    enable() {this.enabled = true; this.visible = true;}
    disable() {this.enabled = false; this.visible = false;}

    delete = false;
    deleteOptionsH?: PIXI.DestroyOptions = {children: true};
    belongsToPool: ObjectPool<TopContainer>|null = null;
    master: TopLogicObject|null = null;

    messageStep(message: Msg, s: SpriteStorage) {}
}

/** A container with dependent objects */
export class Collection<T extends TopLogicObject = TopLogicObject> extends PIXI.Container<T> {   
    constructor(...children: T[]) {
        super();

        if (children.length>0) {
            this.addChild(...children);
        }
    }

    /** Adds a child to the collection only if it is empty. */
    addOneChild(child: T) {
        if (this.children.length===0) {
            this.addChild(child);
        }
    }

    destroyChildren(destroyOptions?: PIXI.DestroyOptions) {
        this.removeChildren().forEach((o)=>{o.destroy(destroyOptions);});
    }
}

export class AutoCollection<T extends TopLogicObject> extends Collection {
    declare children: T[];
    
    constructor(private factory: ()=>T) {
        super();
    }

    instantiate() {
        const obj = this.factory();
        this.addChild(obj);
        return obj;
    }
    instantiateOne() {
        if (this.children.length===0) {
            return this.instantiate();
        }
    }
}

/** Stores a specific amount of reserved objects that can be used later. */
export class ObjectPool<T extends TopLogicObject> {
    private pool: T[] = [];
    private active = new Set<T>();

    /** Counts reserved objects in the pool. */
    get reservedAmount() {
        return this.pool.length;
    }
    get activeAmount() {
        return this.active.size;
    }
    get totalAmount() {
        return this.pool.length+this.active.size;
    }

    constructor(
        private factory: ()=>T,
        private resetFn: (obj: T)=>void,
        targetAmount=0,
        private readonly dontExceedLimit=false
    ) {
        if (targetAmount>0) {
            this.reserve(targetAmount);
        }
    }
    private createNew(): T {
        const obj = this.factory();
        this.resetFn(obj);
        return obj;
    }

    /** A builder method. Creates missing instances of a class and puts
     * them in the reservation pool, or deletes excess ones if the specified
     * amount is less. This does not affect active objects. */
    reserve(targetAmount: number) {
        const totalAmount = this.totalAmount;
        if (totalAmount <= targetAmount) {
            for (let i = totalAmount; i < targetAmount; i++) {
                this.pool.push(this.createNew());
            }
        }
        else {
            const calculatedAmountPool = this.active.size-targetAmount;
            while (this.pool.length > 0 || this.pool.length > calculatedAmountPool) {
                const obj = this.pool.pop();
                if (obj) {
                    obj.destroy();
                }
            }
        }
        return this;
    }

    /** A builder method. Puts all active objects back in the pool. */
    clear() {
        for (const obj of this.active.values()) {
            this.release(obj);
        }
        return this;
    }

    /** A builder method. Destroys all reserved and active objects. */
    destroy(options?: PIXI.DestroyOptions) {
        while (this.pool.length > 0) {
            const obj = this.pool.pop();
            if (obj) {
                obj.destroy(options);
            }
        }
        for (const obj of this.active.values()) {
            this.active.delete(obj);
            obj.destroy(options);
        }
        return this;
    }

    /** Takes an object from the pool, adds it to the parent container,
     * if specified, and returns it. */
    add(parent?: PIXI.Container): T|undefined {
        const obj = (this.pool.length > 0 || this.dontExceedLimit) ? (this.pool.pop()) : this.createNew();
        if (obj) {
            obj.belongsToPool = this;
            if (parent) {
                parent.addChild(obj);
            }
            this.active.add(obj);
        }
        return obj;
    }

    /** Puts an object back in the pool. */
    release(obj: T, checkExistence=false) {
        if ((!checkExistence) || (this.active.has(obj))) {
            obj.removeFromParent();
            obj.belongsToPool = null;
            obj.delete = false;
            this.resetFn(obj);
            this.active.delete(obj);
            this.pool.push(obj);
        }
    }
}


export abstract class ACompCollidable {
    constructor(protected sourceObject: PIXI.Container) {}

    abstract collidePoint(x: number, y: number): boolean;

    /** A virtual pointer index of 0 is also compatible with a mouse. */
    collidePointer(vId: number) {
        const touchProperty = m.pointers.get(vId);
        if (touchProperty) {
            return this.collidePoint(touchProperty.position.x, touchProperty.position.y);
        }
        return false;
    }

   
    /** Finds which pointer is touching this object. 0 also can be the mouse. Returns -1 if none found. */
    collideAnyPointer() {
        for (const [touchIndex, touchProperty] of m.pointers.entries()) {
            if (this.collidePoint(touchProperty.position.x, touchProperty.position.y)) {
                return touchIndex;
            }
        }
        return -1;
    }
}

export class CompHitbox extends ACompCollidable {
    offsetX=0;
    offsetY=0;
    width=0;
    height=0;
    affectScale: boolean;

    constructor(sourceObject: PIXI.Container, hitbox?: HitboxParameters, affectScale=false){
        super(sourceObject);

        this.affectScale = affectScale;
        
        if (hitbox) {
            this.setHitbox(hitbox);
        }
        else {
            this.setHitboxAuto();
        }
    }

    calculateOriginPoint() {
        const bounds = this.sourceObject.getLocalBounds();
        this.offsetX = bounds.minX;
        this.offsetY = bounds.minY;
    }
    setHitbox(hitbox: HitboxParameters) {
        this.offsetX = hitbox.offsetX;
        this.offsetY = hitbox.offsetY;
        this.width = hitbox.width;
        this.height = hitbox.height;
        if (hitbox.calculateOriginPoint) {
            this.calculateOriginPoint();
        }
    }
    setHitboxAuto() {
        this.calculateOriginPoint();
        const bounds = this.sourceObject.getLocalBounds();
        this.width = bounds.width;
        this.height = bounds.height;
    }

    hitboxCollidePoint(x: number, y: number){
        const src = this.sourceObject;
        const scaleX = (this.affectScale) ? src.scale.x : 1;
        const scaleY = (this.affectScale) ? src.scale.y : 1;

        let left = (src.x + (this.offsetX * scaleX));
        let top = (src.y + (this.offsetY * scaleY));
        return (
            (x >= left)
            && (x < left + (this.width * scaleX))
            && (y >= top)
            && (y < top + (this.height * scaleY))
        );
    }

    collidePoint(x: number, y: number): boolean {
        return this.hitboxCollidePoint(x, y);
    }

    collide(other: CompHitbox) {
        const src = this.sourceObject;
        const oth = other.sourceObject;

        const scaleX = this.affectScale ? src.scale.x : 1;
        const scaleY = this.affectScale ? src.scale.y : 1;
        const left = src.x + (this.offsetX * scaleX);
        const top = src.y + (this.offsetY * scaleY);

        const oScaleX = other.affectScale ? oth.scale.x : 1;
        const oScaleY = other.affectScale ? oth.scale.y : 1;
        const oLeft = oth.x + (other.offsetX * oScaleX);
        const oTop = oth.y + (other.offsetY * oScaleY);

        return (
            left + this.width * scaleX > oLeft &&
            left < oLeft + other.width * oScaleX &&
            top + this.height * scaleY > oTop &&
            top < oTop + other.height * oScaleY
        );
    }
}

export class CompMask extends CompHitbox {
    matrix: Uint8Array;
    constructor(sourceObject: PIXI.Container, mask: MaskParameters, affectScale=false){
        super(sourceObject, mask, affectScale);

        this.matrix = mask.matrix;
    }

    collidePoint(x: number, y: number, affectRotation=false): boolean {
        const src = this.sourceObject;
        const affectScale = this.affectScale;

        const scaleX = affectScale ? src.scale.x : 1;
        const scaleY = affectScale ? src.scale.y : 1;

        let newX = x;
        let newY = y;

        if (affectRotation) {
            const rotatedXY = rotatePoint(x, y, src.rotation, src.x, src.y);
            newX = rotatedXY.x;
            newY = rotatedXY.y;
        }

        // Calculate local coordinates relative to the hitbox's upper-left corner
        const rx = ((newX - (src.x + this.offsetX * scaleX)) / scaleX) | 0;
        const ry = ((newY - (src.y + this.offsetY * scaleY)) / scaleY) | 0;

        const width = this.width;

        // check the matrix boundary
        if (rx < 0 || rx >= width || ry < 0 || ry >= this.height) {
            return false;
        }

        // Pixel index in one-dimensional array
        const i = rx + ry * width;

        const byte = this.matrix[i >> 3];
        
        // Use a left shift of the mask, inverting the logic
        return (byte & (0x80 >>> (i & 7))) !== 0;
    }
}

export class CompGroup extends ACompCollidable {
    group;
    constructor(sourceObject: PIXI.Container, group: ACompCollidable[] = []){
        super(sourceObject);
        this.group = group;
    }

    collidePoint(x: number, y: number) {
        for (let collidable of this.group) {
            if (collidable.collidePoint(x, y)) {
                return true;
            }
        }
        return false;
    }
}
