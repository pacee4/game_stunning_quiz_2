import * as PIXI from 'pixi.js';

let error = false;
const dp = window.devicePixelRatio;


//! DEFINE ASSET TYPES AND SOURCES. DEFINE LOADING PROGRESS

const gatheredAssets: {
    htmlImages: Record<string, HTMLImageElement>,
    canvases: Record<string, {c: HTMLCanvasElement, ctx: CanvasRenderingContext2D}>,
    textures: Record<string, PIXI.Texture>,
    masks: Record<string, MaskProps>
} = {
    htmlImages: {},
    canvases: {},
    textures: {},
    masks: {}
};

interface ResourcesToLoad {
    images?: {[index: string]: string},
    svg?: {[index: string]: string},
    fonts?: {[index: string]: string[]},
    audio?: {[index: string]: string},

    masks?: string[],
    /** Note that once pixels have been obtained from images, their scaling mode cannot be changed later! */
    nearestFilterImages?: string[],

    audioVolumeNodes?: string[]
}
interface Source {
    type: "image"|"htmlImage"|"font"|"audio",
    name: string,
    source: string
}
interface ImageResource {
    type: "image",
    name: string,
    v: PIXI.Texture
}
interface HTMLImageResource {
    type: "htmlImage",
    name: string,
    v: HTMLImageElement
}
interface FontResource {
    type: "font"
}
interface AudioResource {
    type: "audio",
    name: string,
    v: AudioBuffer
}


//! CLASS SoundManager
interface SoundOptions {
    offset?: number,
    pitch?: number,
    volumeNode?: string
}

class SoundManager {
    audio: {[index: string]: AudioBuffer} = {};
    audioCtx = <AudioContext> new (window.AudioContext
        /* support for older browsers */||(<any>window).webkitAudioContext)();
    private sources: Map<string, AudioBufferSourceNode> = new Map();
    volumeNodes: Map<string, GainNode> = new Map();

    private playingFirstTime = true;

    /**
     * Plays a sound without keeping its source for stopping.
     * The sound playback will resume on user activation, as the browser
     * does not allow it on page load.
     */
    produce(sound: string, soundOptions?: SoundOptions) {
        this.waitPlaySoundF(sound, false, soundOptions);
    }

    /**
     * Plays a sound and keeps its source for stopping.
     * The sound playback will resume on user activation, as the browser
     * does not allow it on page load.
     */
    play(sound: string, soundOptions?: SoundOptions) {
        this.stop(sound);
        this.waitPlaySoundF(sound, true, soundOptions);
    }

    stop(sound: string) {
        const source = this.sources.get(sound);
        if (source) {
            source.onended = null;
            source.stop(0);
            this.sources.delete(sound);
        }
    }

    stopAll() {
        for (const source of this.sources.values()) {
            source.onended = null;
            source.stop(0);
        }
        this.sources.clear();
    }

    /**
     * Sets volume to sounds with the specific volume node.
     */
    setVolume(volumeNode: string, volume: number) {
        const gainNode = this.volumeNodes.get(volumeNode);
        if (gainNode) {
            gainNode.gain.value = clamp(volume, 0, 1);
        }
    }
    smoothVolume(volumeNode: string, volume: number, duration: number) {
        const gainNode = this.volumeNodes.get(volumeNode);
        if (gainNode) {
            const now = this.audioCtx.currentTime;
            gainNode.gain.linearRampToValueAtTime(clamp(volume, 0, 1), now+duration);
        }
    }

    /**
     * Sets volume to all sounds.
     */
    setVolumeAll(volume: number) {
        for (const gainNode of this.volumeNodes.values()) {
            gainNode.gain.value = clamp(volume, 0, 1);
        }
    }
    smoothVolumeAll(volume: number, duration: number) {
        const now = this.audioCtx.currentTime;
        for (const gainNode of this.volumeNodes.values()) {
            gainNode.gain.linearRampToValueAtTime(clamp(volume, 0, 1), now+duration);
        }
    }

    async pauseCtx() {
        if (this.audioCtx.state === "running") {
            await this.audioCtx.suspend();
        }
    }
    async resumeCtx() {
        if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
        }
    }


    private waitPlaySoundF(sound: string, save: boolean, soundOptions?: SoundOptions) {
        const soundBuffer = this.audio[sound];
        if (!soundBuffer) {
            console.warn(`Cannot find sound: ${sound}`);
            return;
        }

        if (this.audioCtx.state === "suspended") {
            if (this.playingFirstTime) {
                const timeout = 1000;
                const callTime = performance.now();
                this.audioCtx.resume()
                .then(()=>{
                    if (callTime+timeout > performance.now()) {
                        this.playingFirstTime = false;
                        this.playSoundF(soundBuffer, (save)?sound:"", soundOptions);
                    }
                });
            }
        }
        else {
            this.playingFirstTime = false;
            this.playSoundF(soundBuffer, (save)?sound:"", soundOptions);
        }
    }

    private playSoundF(soundBuffer: AudioBuffer, saveTo: string="", soundOptions?: SoundOptions) {
        const source = this.audioCtx.createBufferSource();
        source.buffer = soundBuffer;

        if (soundOptions?.pitch) {
            source.playbackRate.value = soundOptions.pitch;
        }

        const gainNode: GainNode = (
            (soundOptions?.volumeNode)
            ? (this.volumeNodes.get(soundOptions.volumeNode) ?? this.volumeNodes.get("general")!)
            : (this.volumeNodes.get("general")!)
        );

        source.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        source.start(0, soundOptions?.offset);

        if (saveTo) {
            this.sources.set(saveTo, source);
            source.onended = ()=>{
                this.sources.delete(saveTo);
            }
        }
    }
    
}
const soundManager = new SoundManager();

// loading process
async function loadAssets(resourcesToLoad: ResourcesToLoad){
    const resourcesToLoadA: Source[] = [];
    if (resourcesToLoad.images) {
        for (let index in resourcesToLoad.images) {
            resourcesToLoadA.push({
                type: "image",
                name: index,
                source: resourcesToLoad.images[index]
            });
        }
    }
    if (resourcesToLoad.svg) {
        for (let index in resourcesToLoad.svg) {
            resourcesToLoadA.push({
                type: "htmlImage",
                name: index,
                source: resourcesToLoad.svg[index]
            });
        }
    }
    if (resourcesToLoad.audio) {
        for (let index in resourcesToLoad.audio) {
            resourcesToLoadA.push({
                type: "audio",
                name: index,
                source: resourcesToLoad.audio[index]
            });
        }
    }
    if (resourcesToLoad.fonts) {
        for (let index in resourcesToLoad.fonts) {
            const sources = resourcesToLoad.fonts[index];
            for (let source of sources) {
                resourcesToLoadA.push({
                    type: "font",
                    name: index,
                    source: source
                });
            }
        }
    }

    
    const els = {
        progressBarValue: <HTMLDivElement>document.getElementById("progressBarValue"),
        progressBarText: <HTMLDivElement>document.getElementById("progressBarText"),
        progressBarError: <HTMLDivElement>document.getElementById("progressBarError")
    };

    let resourcesLoadedCount = 0;
    const resourcesCount = resourcesToLoadA.length+1;
    function updateProgressBar() {
        if (!error) {
            resourcesLoadedCount+=1;

            const percent = resourcesLoadedCount/resourcesCount*100;
            els.progressBarText.textContent = `Загрузка... ${Math.floor(percent)}%`;

            els.progressBarValue.style.width = `${percent}%`;
        }
    }


    function addResourcesToLoad(resourcesToLoadA: Source[]) {
        async function promiseImage(name: string, url: string): Promise<ImageResource> {
            try {
                const asset = await PIXI.Assets.load<PIXI.Texture>({
                    alias: name,
                    src: url
                });

                updateProgressBar();
                return {
                    type: "image",
                    name: name,
                    v: asset
                };
            }
            catch(error) {
                displayError(url);
                throw error;
            }
        }
        async function promiseSvg(name: string, url: string): Promise<HTMLImageResource> {
            return new Promise((resolve, reject)=>{
                const image: HTMLImageElement = new Image();
                image.onload = ()=>{
                    updateProgressBar();
                    resolve({
                        type: "htmlImage",
                        name: name,
                        v: image
                    });
                };
                image.onerror = ()=>{
                    displayError(url);
                    reject(Error(`Cannot load image: ${url}`));
                }
                image.src = url;
            });
        }
        async function promiseFont(name: string, url: string): Promise<FontResource> {
            try {
                await PIXI.Assets.load({
                    parser: "web-font",
                    src: url,
                    data: {
                        family: name
                    }
                });

                updateProgressBar();
                return {type: "font"};
            }
            catch(error) {
                displayError(url);
                throw error;
            }
        }
        async function promiseAudio(name: string, url: string): Promise<AudioResource> {
            try{
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`${url}: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const soundBuffer = await soundManager.audioCtx.decodeAudioData(arrayBuffer);
                updateProgressBar();
                return {
                    type: "audio",
                    name: name,
                    v: soundBuffer
                }
            }
            catch(error) {
                displayError(url);
                throw error;
            }
        }

        const promises: Promise<ImageResource|HTMLImageResource|FontResource|AudioResource>[] = [];
        for (let source of resourcesToLoadA) {
            if (source.type === "image") {
                promises.push(promiseImage(source.name, source.source));
            }
            if (source.type === "htmlImage") {
                promises.push(promiseSvg(source.name, source.source));
            }
            if (source.type === "font") {
                promises.push(promiseFont(source.name, source.source));
            }
            if (source.type === "audio") {
                promises.push(promiseAudio(source.name, source.source));
            }
        }
        return promises;
    }

    updateProgressBar(); // including this JavaScript file

    const resourcesLoadedA = await Promise.all(addResourcesToLoad(resourcesToLoadA));
    for (let resource of resourcesLoadedA) {
        if (resource.type === "image") {
            gatheredAssets.textures[resource.name] = resource.v;
        }
        if (resource.type === "htmlImage") {
            gatheredAssets.htmlImages[resource.name] = resource.v;
        }
        if (resource.type === "audio") {
            soundManager.audio[resource.name] = resource.v;
        }
    }
}

function displayError(reason: string) {
    if (!error) {
        error = true;
        const elProgressBarError = document.getElementById("progressBarError")!;

        showEl(document.getElementById("divProgressBar")!);
        hideEl(document.getElementById("divGame")!);
        showEl(elProgressBarError);

        document.getElementById("progressBarText")!.textContent = "Ошибка загрузки";
        elProgressBarError.textContent = reason;
    }
}

//! FUNCTIONS
// general

function remainder(n: number, m: number) {
    return ((n % m) + m) % m;
}
function randomNumber(min: number, max: number, span=1) {
    return (Math.floor(Math.random()*Math.abs(max-min+span)/span)*span)+min;
}
function scale(value: number, fromLow: number, fromHigh: number, toLow: number,
toHigh: number) {
    return ((value - fromLow) / ((fromHigh - fromLow) / (toHigh - toLow))) + toLow;
}
function clamp(value: number, min: number, max: number) {
    if(min > max){
        let temp = min;
        min = max;
        max = temp;
    }
    return (value < min) ? min : ((value > max) ? max : value);
}
function scaleClamp(value: number, fromLow: number, fromHigh: number, toLow:
number, toHigh: number) {
    return clamp(scale(value, fromLow, fromHigh, toLow, toHigh), toLow, toHigh);
}
function isBetween(value: number, min: number, max: number) {
    if(min > max){
        let temp = min;
        min = max;
        max = temp;
    }
    return ((value >= min) && (value <= max));
}
function between(min: number, max: number, range=0.5) {
    return ((max-min)*range)+min;
}
function span(value: number, threshold=1) {
    return Math.round(value/threshold)*threshold;
}
function arrayMove<T>(array: Array<T>, index: number, targetIndex: number) {
    array.splice(targetIndex, 0, array.splice(index, 1)[0]);
}
/**
 * Moves the point.
 * @param direction Angle in radians. 0 means to the right.
 */
function moveBy(x: number, y: number, steps: number, direction: number) {
    const relX = steps * Math.cos(direction);
    const relY = steps * Math.sin(direction);
    return {x: (x+relX), y: (y+relY)};
}

function distance(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
}
function pointTowards(x1: number, y1: number, x2: number, y2: number) {
    return Math.atan2(y2-y1, x2-x1);
}
function rotatePoint(x: number, y: number, angle: number, anchorX=0, anchorY=0) {
    const absX = x-anchorX;
    const absY = y-anchorY;
    return {
        x: (absX*Math.cos(angle) + absY*Math.sin(angle))+anchorX,
        y: (-absX*Math.sin(angle) + absY*Math.cos(angle))+anchorY
    };
}

function ease(t: number, easeMode:
    "sineIn"|"sineOut"|"sineInOut"|"quadIn"|"quadOut"|"quadInOut"|"cubicIn"|"cubicOut"|"cubicInOut"
){
    switch (easeMode){
        case "sineIn":
            return 1 - Math.cos(t * Math.PI / 2);
        case "sineOut":
            return Math.sin(t * Math.PI / 2);
        case "sineInOut":
            return -(Math.cos(Math.PI * t) - 1) / 2;
        case "quadIn":
            return t * t;
        case "quadOut":
            return 1 - ((1-t)*(1-t));
        case "quadInOut":
            return (
                (t<0.5)
                ? (t*t*4)/2
                : 1-((1-t)*(1-t)*4)/2
            );
        case "cubicIn":
            return t * t * t;
        case "cubicOut":
            return 1 - ((1-t)*(1-t)*(1-t));
        case "cubicInOut":
            return (
                (t<0.5)
                ? (t*t*t*8)/2
                : 1-((1-t)*(1-t)*(1-t)*8)/2
            );
        default:
            return t;
    }
}


//! CLASSES
//#region 
// Object holders for actual scaling
const holder: {
    texts: Set<SmoothText>
} = {
    texts: new Set()
}

class Sprite extends PIXI.Sprite {
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

/** The text will always remain smooth. */
class SmoothText extends PIXI.Text {

    constructor(options?: PIXI.CanvasTextOptions) {
        super(options);

        // add
        holder.texts.add(this);
        screen.updateTextResolution(this);
        // handle destroy
        this.addListener("destroyed", ()=>{
            holder.texts.delete(this);
        });
    }
}


interface TopLogicObject {
    new: boolean;
    /**
     * Whether this object can receive messages. This does not affect visibility. If this property is `false`, the object must be accessed directly.
     */
    enabled: boolean;
    enable: ()=>void;
    disable: ()=>void;

    messageStep(message: Msg): void;
}

class TopSprite extends Sprite implements TopLogicObject {
    new = true;
    enabled = true;
    enable() {this.enabled = true; this.visible = true;}
    disable() {this.enabled = false; this.visible = false;}

    messageStep(message: Msg) {}
}

/** A container with independent objects */
class TopContainer extends PIXI.Container implements TopLogicObject {
    new = true;
    enabled = true;
    enable() {this.enabled = true; this.visible = true;}
    disable() {this.enabled = false; this.visible = false;}

    messageStep(message: Msg) {}
}

/** A container with dependent objects */
class TopCollection<T extends TopObjectType = TopObjectType> extends PIXI.Container {
    declare children: T[];
    
    constructor(...children: T[]) {
        super();

        if (children.length>0) {
            this.addChild(...children);
        }
    }

    destroyChildren(texture=false) {
        this.removeChildren().forEach((o)=>{o.destroy(texture);});
    }
}

class Messages {
    private messages: Array<Msg> = [];
    broadcastFirst(value: Msg){
        if(!this.messages.includes(value)){
            this.messages.unshift(value);
        }
    }
    broadcast(value: Msg){
        if(!this.messages.includes(value)){
            this.messages.push(value);
        }
    }
    clear() {
        this.messages.splice(0);
    }
    obtain() {
        return this.messages.shift();
    }
    isNotEmpty() {
        return (this.messages.length!==0);
    }
}


//! OBJECT COMPONENTS
interface HitboxProps {
    /**
     * The offset by X from the left of the sprite.
     */
    offsetX: number,
    /**
     * The offset by Y from the top of the sprite.
     */
    offsetY: number,
    /**
     * The width of the hitbox.
     */
    width: number,
    /**
     * The height of the hitbox.
     */
    height: number

    matrix?: Uint8Array
}
interface MaskProps extends HitboxProps {
    matrix: Uint8Array
}

abstract class ACompCollidable {
    constructor(protected sourceObject: PIXI.Container) {}

    abstract collidePoint(x: number, y: number): boolean;

    /** A touch index of 0 is also compatible with a mouse. */
    collideFinger(touchIndex: number) {
        const touchProperty = m.touches.get(touchIndex);
        if (touchProperty) {
            return this.collidePoint(touchProperty.position.x, touchProperty.position.y);
        }
        return false;
    }

   
    /** Finds which finger is touching this object. 0 also can be the mouse. Returns -1 if none found. */
    // MAY NOT BE NEEDED
    collideAnyFinger() {
        for (const [touchIndex, touchProperty] of m.touches.entries()) {
            if (this.collidePoint(touchProperty.position.x, touchProperty.position.y)) {
                return touchIndex;
            }
        }
        return -1;
    }
}

class CompHitbox extends ACompCollidable implements HitboxProps {
    offsetX=0;
    offsetY=0;
    width=0;
    height=0;

    constructor(sourceObject: PIXI.Container, hitbox?: HitboxProps){
        super(sourceObject);
        
        if (hitbox) {
            this.setHitbox(hitbox);
        }
        else {
            this.setHitboxAuto();
        }
    }

    calculateOriginPoint() {
        const bounds = this.sourceObject.getLocalBounds();
        this.offsetX = bounds.minX * this.sourceObject.scale.x;
        this.offsetY = bounds.minY * this.sourceObject.scale.y;
    }
    setHitbox(hitbox: HitboxProps) {
        this.offsetX = hitbox.offsetX;
        this.offsetY = hitbox.offsetY;
        this.width = hitbox.width;
        this.height = hitbox.height;
    }
    setHitboxAuto() {
        this.calculateOriginPoint();
        this.width = this.sourceObject.width;
        this.height = this.sourceObject.height;
    }

    hitboxCollidePoint(x: number, y: number){
        let left = (this.sourceObject.x + this.offsetX);
        let top = (this.sourceObject.y + this.offsetY);
        return (
            (x >= left)
            && (x < left + this.width)
            && (y >= top)
            && (y < top + this.height)
        );
    }

    collidePoint(x: number, y: number): boolean {
        return this.hitboxCollidePoint(x, y);
    }

    collide(other: CompHitbox) {
        let left = (this.sourceObject.x + this.offsetX);
        let top = (this.sourceObject.y + this.offsetY);
        let otherLeft = (other.sourceObject.x + other.offsetX);
        let otherTop = (other.sourceObject.y + other.offsetY);
        
        return (
            (left+this.width > otherLeft)
            && (left < otherLeft+other.width)
            && (top+this.height > otherTop)
            && (top < otherTop+other.height)
        );
    }
}

class CompMask extends CompHitbox implements MaskProps {
    matrix: Uint8Array;
    constructor(sourceObject: PIXI.Container, mask: MaskProps){
        super(sourceObject, mask);

        this.matrix = mask.matrix;
    }

    collidePoint(x: number, y: number): boolean {
        if (this.hitboxCollidePoint(x, y)) {
            let left = (this.sourceObject.x + this.offsetX);
            let top = (this.sourceObject.y + this.offsetY);
            
            let rx = Math.floor(x-left);
            let ry = Math.floor(y-top);
            let i = rx+(ry*this.width);
            let B = Math.floor(i/8);
            let b = i%8;
            let byte = this.matrix[B];
            let booleanBit = (byte & (1 << (7-b))) !== 0;
            return booleanBit;
        }
        return false;
    }
}

class CompGroup extends ACompCollidable {
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


class CompClickable {
    protected sourceObject: PIXI.Container;
    protected collidable: ACompCollidable;
    clickable: boolean;

    constructor(sourceObject: PIXI.Container, collidable: ACompCollidable){
        this.sourceObject = sourceObject;
        this.collidable = collidable;
        this.clickable = true;
    }

    checkClickTouch(touchProperty: TouchProperty) {
        if (this.clickable && this.sourceObject.visible) {
            let collision = this.collidable.collidePoint(touchProperty.position.x, touchProperty.position.y);
            if ((!touchProperty.holding) && collision) {
                return true;
            }
        }
        return false;
    }
}
//#endregion


//! SENSING PROPERTIES
interface KeyProperty {
    character: string,
    holding: boolean
}
interface TouchProperty {
    position: {x: number, y: number},
    holding: boolean
}

class SensingProperties {
    resolutionHasChanged = false;

    get isResized() {
        return this.resolutionHasChanged;
    }
    isFocused = false;

    mouseX = -1;
    mouseY = -1;

    touches: Map<number, TouchProperty> = new Map();
    
    /** Touch index 0 is also compatible with a mouse. */
    fingerIsDown(touchIndex: number) {
        return this.touches.has(touchIndex);
    }
    /** Touch index 0 is also compatible with a mouse. */
    fingerIsPressed(touchIndex: number) {
        const touchProperty = this.touches.get(touchIndex);
        return (touchProperty ? (!touchProperty.holding) : false);
    }

    /** This method is also compatible with a mouse. */
    oneFingerIsPressed() {
        return m.touches.size === 1 && this.fingerIsPressed(0);
    }
    /** Touch index 0 can also be the mouse. Returns -1 if none found. */
    getNewFingerIndex() {
        for (const [touchIndex, touchProperty] of this.touches.entries()) {
            if (!touchProperty.holding) return touchIndex;
        }
        return -1;
    }

    // (OPTIONAL)
    keyboardCodes: Map<string, KeyProperty> = new Map();

    simulateKeyDown(code: string, key="") {
        if ((code!=="" && code!=="Unidentified") && !this.keyboardCodes.has(code)) {
            this.keyboardCodes.set(code, {character: key, holding: false});
        }
    }
    simulateKeyUp(code: string) {
        this.keyboardCodes.delete(code);
    }

    keyIsDown(code: string) {
        return this.keyboardCodes.has(code);
    }
    keyIsPressed(code: string) {
        const keyProperty = this.keyboardCodes.get(code);
        return (keyProperty ? (!keyProperty.holding) : false);
    }
    characterIsPrinted(character: string) {
        for (const value of this.keyboardCodes.values()) {
            if (value.character === character) {
                return true;
            }
        }
        return false;
    }

    /** Total elapsed time in seconds. */
    time = 0;
    /** Difference in seconds between two frames. */
    delta = 0;

    messages = new Messages();
    
    readonly isMobile = matchMedia("((min-resolution: 2dppx) or (max-width: 600px))").matches;

    /** If the device is a computer, or a device with a mouse connected, the project
     * will handle mouse and keyboard inputs. Otherwise, touches are handled. */
    readonly isTouchDevice = matchMedia("((pointer: coarse) and (not (any-pointer: fine)))").matches;
    /** If the device is a computer, or a device with a mouse connected, the project
     * will handle mouse and keyboard inputs. Otherwise, touches are handled. */
    readonly isComputer = !this.isTouchDevice;
}
const m = new SensingProperties();


//! MESSAGES (EDITABLE)
enum Msg {
    /** Broadcasts when the project has finished loading. */
    START = "START",
    /** Broadcasts on each screen refresh. */
    TICK = "TICK",

    INIT_SHOW_CAUTION = "SHOW_CAUTION",
    CLOSE_CAUTION = "HIDE_CAUTION",
    SHOW_MENU = "SHOW_MENU",
    SHOW_MENU2 = "SHOW_MENU2",
    HIDE_MENU = "HIDE_MENU",

    SHOW_INSTRUCTIONS = "SHOW_INSTRUCTIONS",
    HIDE_INSTRUCTIONS = "HIDE_INSTRUCTIONS",

    INIT_GAME = "INIT_GAME",

    START_GAME = "START_GAME",
    NEXT_QUESTION = "NEXT_QUESTION",

    TICK_MENU_CLICK = "TICK_MENU_CLICK",
    TICK_MENU_LOGIC = "TICK_MENU_LOGIC",

    TICK_GAME_CLICK = "TICK_GAME_CLICK",
    TICK_GAME_LOGIC = "TICK_GAME_LOGIC",
    TICK_GAME_BOMB = "TICK_GAME_BOMB",

    SHOW_GAME_OVER = "SHOW_GAME_OVER",
    
    PLAY_CLICKED = "PLAY_CLICKED",
    PLAY_AGAIN_CLICKED = "PLAY_AGAIN_CLICKED",
    GAME_COMPLETE = "GAME_COMPLETE",
}

//! CUSTOM IMPLEMENTATION (EDITABLE)

function getColorFromGradient(colors=["#000000","#ffffff"], factor=0) {
    factor = clamp(factor, 0, 1); // MINE
    // BELOW CODE GENERATED BY AI

    // If there's only one color, return it
    if (colors.length === 1) return colors[0];

    // Find the two colors to interpolate between
    const index = (colors.length - 1) * factor;
    const i = Math.floor(index);
    const t = index - i; // Relative position within the segment (0 to 1)

    const color1 = colors[i];
    const color2 = colors[Math.min(i + 1, colors.length - 1)];

    // Interpolate between the two colors (assuming hex format #RRGGBB)
    const rgb = [0, 1, 2].map(j => {
        const c1 = parseInt(color1.slice(1 + j * 2, 3 + j * 2), 16);
        const c2 = parseInt(color2.slice(1 + j * 2, 3 + j * 2), 16);
        return Math.round(c1 * (1 - t) + c2 * t);
    });

    // Convert RGB to hex
    return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

interface AnimationParameter {
    duration: number,
    /** Time offset since the animation start. */
    offset?: number,

    onStart?: (t: AnimationTimeProperties)=>void,
    onTick?: (t: AnimationTimeProperties)=>void,
    /** If this callback is defined, it will be executed instead of `onTick()` when the animation part is finished. */
    onFinish?: (t: AnimationTimeProperties)=>void
}
interface AnimationParameterE extends AnimationParameter {
    offset: number
}
interface AnimationTimeProperties {
    time: number,
    totalTime: number,
    duration: number,
    percent: number
}
class AnimationSequence {
    animationList: AnimationParameterE[] = [];

    private idleAnimations = new Set<AnimationParameterE>();
    private playingAnimations = new Set<AnimationParameterE>();

    /** Time in seconds since an animation has started. */
    totalTime = 0;
    /** Whether the animation is playing. If this property is false, the animation has paused or stopped. */
    playing = false;
    /** Whether the animation can be played again using `startOnce()`. */
    canStart = true;

    /** Executed at the start of the animation. Call this method to set the initial state immediately. */
    public onStart?: ()=>void;
    constructor(onStart?: ()=>void) {
        this.onStart = onStart;
    }

    /** A builder method. */
    createState(properties: AnimationParameter) {
        this.animationList.push({
            duration: properties.duration,
            offset: properties.offset ?? 0,
            onStart: properties.onStart,
            onTick: properties.onTick,
            onFinish: properties.onFinish
        });
        return this;
    }

    start(noFirstTick=false, timeOffset=0) {
        this.playing = true;
        this.totalTime = timeOffset;

        for (const animation of this.animationList) {
            this.idleAnimations.add(animation);
        }
        this.playingAnimations.clear();

        if (this.onStart) {
            this.onStart();
        }
        
        if (!noFirstTick) {
            for (const animation of this.animationList.filter((el)=>(el.offset === 0))) {
                if (animation.onTick) {
                    animation.onTick(this.getTimeProperty(animation, (timeOffset)));
                }
            } 
        }
    }

    /** Controlled by the property `canStart`. */
    startOnce(noFirstTick=false, timeOffset=0) {
        if (this.canStart) {
            this.canStart = false;
            this.start(noFirstTick, timeOffset);
        }
    }

    stop() {
        this.playing = false;
    }

    /** An essential method for handling animation. When not called, the animation is paused. */
    simulateTick() {
        if (this.playing) {
            this.totalTime += m.delta;

            // handle idle animations
            for (const animation of this.idleAnimations.values()) {
                if (this.totalTime >= animation.offset) {
                    this.idleAnimations.delete(animation);
                    this.playingAnimations.add(animation);

                    if (animation.onStart) {
                        animation.onStart(this.getTimeProperty(animation, (this.totalTime - animation.offset)));
                    }
                }
            }

            // handle playing animations
            for (const animation of this.playingAnimations.values()) {
                if (this.totalTime >= animation.offset+animation.duration) {
                    // animation has finished
                    this.playingAnimations.delete(animation);
                    if (this.idleAnimations.size === 0 && this.playingAnimations.size === 0) {
                        this.playing = false;
                    }

                    if (animation.onFinish) {
                        animation.onFinish(this.getTimeProperty(animation, (animation.duration)));
                    }
                    else if (animation.onTick) {
                        animation.onTick(this.getTimeProperty(animation, (animation.duration)));
                    }
                }
                else {
                    // animation is playing
                    if (animation.onTick) {
                        animation.onTick(this.getTimeProperty(animation, (this.totalTime - animation.offset)));
                    }
                }
            }
        }
    }

    private getTimeProperty(anim: AnimationParameterE, time: number): AnimationTimeProperties {
        return {
            time: time,
            totalTime: this.totalTime,
            duration: anim.duration,
            percent: (anim.duration > 0) ? time/anim.duration : 0
        }
    }
}



//! GLOBAL VARIABLES (EDITABLE)

class GlobalProperties {
    lives = 0;
    private questionN = 0;
    
    get question() {
        return this.questionN;
    }
    /** custom setter */
    set question(b: number) {
        if (Main.clearQuestionFunctions[this.questionN]) {
            Main.clearQuestionFunctions[this.questionN]();
        }
        this.questionN = b;
        if (Main.startQuestionFunctions[this.questionN]) {
            Main.startQuestionFunctions[this.questionN]();
        }
    }

    itemsInSchoolbag: string[] = [];
    schoolSubjects: number[] = [];
    allowedItems: string[] = [];
    selectedSubject: number = 0;

    readonly CORRECT_ANSWERS: {[index: number]: number} = {
        31: 1,
        32: 1,
        33: 4,
        34: 1,
        35: 2,
        38: 4,
        39: 3,
        41: 3,
        42: 1,
        43: 3,
        46: 3,
        47: 2,
        52: 1,
        54: 4,
        56: 3,
        57: 3,
        58: 2,
        59: 3,
        61: 2,
        62: 5,
        64: 2,
        65: 1,
        66: 4,
        67: 5,
        69: 2,
    }
    readonly TIME_BOMBS: {[index: number]: number} = {
        50: 15,
        55: 10,
        57: 10,
        60: 10,
        66: 10,
        68: 10,
        70: 3, // 15
    }
    readonly ILLUSTRATION_QUESTIONS = [39, 57];

    readonly RUSSIAN_LETTERS = "абвгдежзийклмнопрстуфхцчшщъыьэюя";
}
const g = new GlobalProperties();



//! LAYERS (EDITABLE)
const layers: PIXI.RenderLayer[] = [];
for (let i = 1; i <= 1 /* number of layers (EDITABLE) */; i++) {
    layers.push(new PIXI.RenderLayer());
}




//! OBJECTS (EDITABLE)
class Main extends TopContainer {

    invulnerability = 0;
    isGame = false;
    gameTick = false;
    readonly fLoseLife = ()=>{this.loseLife()};
    readonly fNextQuestion = ()=>{this.nextQuestion();}
    
    get canClick() {return (this.invulnerability <= 0 && this.gameTick);}

    menuIsClickable = true;

    // animations
    animMoveIn = new AnimationSequence(()=>{
        this.menuIsClickable = false;
    })
        .createState({
            duration: 1.6,
            onTick: (t)=>{
                s.title.children[0].animMoveInTick(t.percent);
                s.button_play_part_link.children[0].animMoveInTick(t.percent);
                s.button_play.children[0].animMoveInTick(t.percent);
                s.button_how_to_play.children[0].animMoveInTick(t.percent);
                s.instruction_poster1.children[0].animMoveInTick(t.percent);
                s.instruction_poster2.children[0].animMoveInTick(t.percent);
                s.button_back.children[0].animMoveInTick(t.percent);

                if (t.percent >= 1) {
                    this.menuIsClickable = true;
                }
            }
        });


    private animPlayClicked = new AnimationSequence(()=>{
        layers[0].attach(s.title.children[0]);

        s.title.children[0].anim.e2P.start();
        s.effect_plain_cover.animPlay();
    })
        .createState({
            duration: 1,
            onFinish: ()=>{
                s.effect_paint.animPlay();
            }
        })
        .createState({
            offset: 1,
            duration: 1,
            onFinish: ()=>{
                m.messages.broadcast(Msg.INIT_GAME);
                s.effect_plain_cover.animEffect2.start();
            }
        });
    

    private animPlayAgainClicked = new AnimationSequence(()=>{
        s.effect_paint.animPlay();
        s.button_play_again.animEffect2.start();
    })
        .createState({
            duration: 0.8,
            onFinish: ()=>{
                m.messages.broadcast(Msg.START_GAME);
            }
        })

    // commands
    public loseLife() {
        if (this.canClick) {
            g.lives--;
            if (g.lives === 0) {
                this.gameOver();
            }
            else {
                this.invulnerability = 0.3;
                this.effectLifeLost();
            }
        }
    }

    public effectLifeLost() {
        soundManager.produce("pew");
        s.lives_number.children[0].effectLifeLost();
    }

    public gameOver(noSound=false) {
        this.isGame = false;
        if (!noSound) { 
            m.messages.broadcast(Msg.SHOW_GAME_OVER);
            soundManager.produce("game_over");
        }
        s.effect_smudge.reset();
        s.game_over_poster.reset();
        s.button_play_again.reset();
    }

    public explode() {
        if (this.isGame && this.gameTick) {
            this.isGame = false;
            m.messages.broadcast(Msg.SHOW_GAME_OVER);

            soundManager.produce("explosion");
            s.effect_explosion.reset();
        }
    }

    public nextQuestion() {
        this.gameTick = false;
        if (g.question < 70) {
            m.messages.broadcast(Msg.NEXT_QUESTION);
        }
        else {
            Main.clearQuestionFunctions[70]();
            m.messages.broadcast(Msg.GAME_COMPLETE);
        }
    }


    static readonly startQuestionFunctions: {[index: number]: ()=>void} = {
        36: ()=>{
            s.q36_controller.addChild(new S36_Controller());
            for (let side of ["left", "right"]) {
                const numbers = [0, 1, 2, 3];
                for (let i = 0; i < 4; i++) {
                    s.q36_elements.addChild(new S36_Elements(
                        numbers.splice(randomNumber(0, numbers.length-1), 1)[0], 
                        i, (<any>side)
                    ));
                }
            }
        },
        37: ()=>{
            s.misc.addChild(
                new SButtonConfigurable(
                    {
                        idle: "37:drum",
                        x: 97, y: 156, clickHitboxProps: gatheredAssets.masks["37:drum"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fNextQuestion
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:cymbal",
                        x: 254, y: 155, clickHitboxProps: gatheredAssets.masks["37:cymbal"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:guitar",
                        x: 401, y: 143, clickHitboxProps: gatheredAssets.masks["37:guitar"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:trumpet",
                        x: 162, y: 248, clickHitboxProps: gatheredAssets.masks["37:trumpet"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:triangle",
                        x: 324, y: 242, clickHitboxProps: gatheredAssets.masks["37:triangle"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                )
            );
        },
        40: ()=>{
            // here the order doesn't matter
            s.q40_controller.addChild(new S40_Controller());
            s.q40_background_cover.addChild(new S40_BackgroundCover());
            s.q40_screen.addChild(new S40_Screen());
            s.q40_screen_flash.addChild(new S40_ScreenFlash());
            for (let i = 0; i < 8; i++) {
                s.q40_buttons.addChild(new S40_Buttons(i));
            }

            s.q40_string.addChild(new S40_String());
            s.q40_tip.addChild(new S40_FadeTip());
            s.q40_red_frame.addChild(new S40_RedFrame());
        },
        44: ()=>{
            s.q44_begin_text.addChild(new S44_BeginText());
            s.q44_begin_point.addChild(new S44_BeginPoint());
            s.q44_maze.addChild(new S44_Maze());
            s.q44_maze_text.addChild(new S44_MazeText());

            S44_BeginText.hideMaze();
        },
        45: ()=>{
            s.q45_controller.addChild(new S45_Controller());
            const treasureI = randomNumber(0, 2);
            for (let i = 0; i < 3; i++) {
                s.q45_chests.addChild(new S45_Chests(i, (i===treasureI)));
            }
            s.q45_text.addChild(new S45_Text());

            s.q45_controller.children[0].startShuffleChests();
        },
        48: ()=>{
            const columnsX = [151, 329];
            const rowsY = [159, 213, 267];
            const rowsTextures = ["48:green_paint_bucket", "48:gray_paint_bucket", "48:brown_paint_bucket"]
            for (let row = 0; row < rowsY.length; row++) {
                for (let col = 0; col < columnsX.length; col++) {
                    s.misc.addChild(new SButtonConfigurable({idle: "48:button", 
                        x: columnsX[col], y: rowsY[row],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: (row===0 && col===1) ? s.main.fNextQuestion : s.main.fLoseLife
                    }));

                    if (col===0) {
                        s.misc.addChild(new SSpriteImage(rowsTextures[row],
                        {x: columnsX[col], y: rowsY[row]}));
                    }
                    else {
                        s.misc.addChild(new SSpriteImage(rowsTextures[row],
                        {x: columnsX[col]-20, y: rowsY[row]}));
                        s.misc.addChild(new SSpriteImage(rowsTextures[row],
                        {x: columnsX[col]+20, y: rowsY[row]}));
                    }
                }
            }
        },
        49: ()=>{
            s.button_next.children[0].enable();

            // items

            s.q49_schoolbag.addChild(new S49_Schoolbag());
            {
                const positions = [
                    [215, 164], [211, 242], [284, 90], [355, 90], [427, 92], [278, 173], [352, 173], [423, 173], [275, 258], [345, 258], [414, 259]
                ];
                const items = ["airpods", "charger", "pen", "textbook-1", "textbook-2", "textbook-3", "textbook-4",
                    "exercise_book-1", "exercise_book-2", "exercise_book-3", "exercise_book-4"];
                const itemsLength = items.length;
                for (let i = 0; i < itemsLength; i++) {
                    let item = items.splice(randomNumber(0, items.length-1), 1)[0];
                    s.q49_draggable_items.addChild(new S49_DraggableItems(
                        item,
                        randomNumber(positions[i][0]-20, positions[i][0]+20),
                        randomNumber(positions[i][1]-10, positions[i][1]+10),
                    ));
                }
            }

            // school subjects
            for (let i = 0; i < g.schoolSubjects.length; i++) {
                s.misc.addChild(new SSpriteImage(
                    ("49:subject-"+(g.schoolSubjects[i])), 
                    {x: 156, y: 51+(i*24), tint: "#606060"}
                ));
            }
        },
        50: ()=>{
            s.q50_arrow_level.addChild(new S50_ArrowLevel());
        },
        51: ()=>{
            s.q51_bean.addChild(new S51_BeanAndController());
            for (let i = 0; i < 7; i++) {
                s.misc.addChild(new SButtonConfigurable({
                    idle: "51:note",
                    x: 144+(i*45),
                    y: 231-(i*10),
                    idleTintColor: "#000000",
                    clickProcessMessage: Msg.TICK_GAME_CLICK,

                    clickAction: (obj)=>{
                        if (s.q51_bean.children[0].processClick(i)) {
                            obj.clickable = false;
                            obj.tint = "#008000";
                        };
                    }
                }));
            }
        },
        53: ()=>{
            s.button_next.children[0].enable();

            s.q53_controller.addChild(new S53_Controller());
            {
                const numbers = [1, 2, 3, 4, 5, 6];
                for (let i = 0; i < 6; i++) {
                    s.q53_draggable_items.addChild(new S53_DraggableItems(
                        i,
                        numbers.splice(randomNumber(0, numbers.length-1), 1)[0],
                    ));
                }
            }
        },
        55: ()=>{
            s.q55_background.addChild(new S55_Background());
            s.q55_question_text.addChild(new S55_QuestionText());

            // schoolbag
            s.q49_schoolbag.addChild(new S49_Schoolbag());

            // selected school subject
            s.misc.addChild(new SSpriteImage(
                ("49:subject-"+(g.selectedSubject)), 
                {x: 254, y: 105, tint: "#000000"}
            ));
        },
        56: ()=>{
            s.q56_controller.addChild(new S56_Controller());
            s.q56_question_text.addChild(new S56_QuestionText());
        },
        60: ()=>{
            s.q60_pump.addChild(new S60_Pump());
            s.q60_volleyball.addChild(new S60_Volleyball());
        },
        62: ()=>{
            s.misc.addChild(new SButtonConfigurable({idle: "question-62-a", 
                x: 0, y: 0, anchor:{x:0,y:0},
                clickProcessMessage: Msg.TICK_GAME_CLICK,
                clickHitboxProps: {offsetX: 324, offsetY: 74, width: 126, height: 42},
                clickAction: s.main.fNextQuestion
            }));
        },
        63: ()=>{
            s.q63_controller.addChild(new S63_Controller());

            s.q63_matches.addChild(
                new S63_Matches(310, 120, 3),

                new S63_Matches(310, 184, 1),
                new S63_Matches(240, 184, 3),

                new S63_Matches(310, 248, 1),
                new S63_Matches(240, 248, 1),
                new S63_Matches(170, 248, 3),

                new S63_Matches(310, 312, 1),
                new S63_Matches(240, 312, 1, true),
                new S63_Matches(170, 312, 1),

                new S63_Matches(275, 152, 0),
                new S63_Matches(345, 152, 0),

                new S63_Matches(205, 216, 0),
                new S63_Matches(275, 216, 0),
                new S63_Matches(345, 216, 0, true),

                new S63_Matches(135, 280, 0),
                new S63_Matches(205, 280, 0),
                new S63_Matches(275, 280, 0),
                new S63_Matches(345, 280, 0),
            );
        },
        65: ()=>{
            s.misc.addChild(new S65_QuestionContent());
        },
        67: ()=>{
            let counter = 0;
            const fClickAction = ()=>{
                counter++;
                if (counter >= 67) {
                    s.main.nextQuestion();
                }
            }

            s.question_number.children[0].visible = false;
            s.misc.addChild(new SButtonConfigurable({
                idle: "question_number-67-circle",
                x: 39,
                y: 39,
                clickProcessMessage: Msg.TICK_GAME_CLICK,
                clickAction: fClickAction,
            }));
        },
        68: ()=>{
            s.button_next.children[0].enable();

            s.q68_controller.addChild(new S68_Controller());
            s.q68_background.addChild(new S68_Background());

            const keyLocations: ReadonlyArray<[number, number]> = [
                [153, 257],
                [323, 295],
                [115, 257],
                [259, 219],
                [343, 257],
                [183, 219],
                [381, 257],
                [373, 219],
                [209, 295],
                [31, 219],
                [145, 219],
                [305, 257],
                [171, 295],
                [221, 219],
                [267, 257],
                [191, 257],
                [229, 257],
                [133, 295],
                [247, 295],
                [107, 219],
                [39, 257],
                [411, 219],
                [69, 219],
                [95, 295],
                [297, 219],
                [335, 219],
                [449, 219],
                [77, 257],
                [285, 295],
                [419, 257],
                [361, 295],
                [57, 295]
            ];

            for (let i = 0; i < keyLocations.length; i++) {
                s.q68_key_buttons.addChild(new S68_KeyButtons(i, keyLocations[i][0], keyLocations[i][1]));
            }
        },
        70: ()=>{
            s.q70_question_text.addChild(new S70_QuestionText());
            s.q70_button.addChild(new S70_Button());
        }
    }
    static readonly clearQuestionFunctions: {[index: number]: ()=>void} = {
        36: ()=>{
            s.q36_controller.destroyChildren();
            s.q36_elements.destroyChildren();
            s.q36_lines.destroyChildren();
        },
        40: ()=>{
            s.q40_controller.destroyChildren();
            s.q40_background_cover.destroyChildren();
            s.q40_screen.destroyChildren();
            s.q40_screen_flash.destroyChildren();
            s.q40_buttons.destroyChildren();
            s.q40_string.destroyChildren();
            s.q40_tip.destroyChildren();
            s.q40_red_frame.destroyChildren();
        },
        44: ()=>{
            s.q44_begin_text.destroyChildren();
            s.q44_begin_point.destroyChildren();
            s.q44_maze.destroyChildren();
            s.q44_maze_text.destroyChildren();
        },
        45: ()=>{
            s.q45_controller.destroyChildren();
            s.q45_chests.destroyChildren();
            s.q45_text.destroyChildren();
        },
        49: ()=>{
            s.q49_draggable_items.destroyChildren();
            s.q49_schoolbag.destroyChildren();
        },
        50: ()=>{
            s.q50_arrow_level.destroyChildren();
        },
        51: ()=>{
            s.q51_bean.destroyChildren();
        },
        53: ()=>{
            s.q53_controller.destroyChildren();
            s.q53_draggable_items.destroyChildren();
        },
        55: ()=>{
            s.q55_background.destroyChildren();
            s.q55_question_text.destroyChildren();
            s.q49_schoolbag.destroyChildren();
            s.q49_draggable_items.destroyChildren();
        },
        56: ()=>{
            s.q56_controller.destroyChildren();
            s.q56_question_text.destroyChildren();
            s.q56_background.destroyChildren(true);
        },
        60: ()=>{
            s.q60_pump.destroyChildren();
            s.q60_volleyball.destroyChildren();
        },
        63: ()=>{
            s.q63_controller.destroyChildren();
            s.q63_matches.destroyChildren();
        },
        67: ()=>{
            s.question_number.children[0].visible = true;
        },
        68: ()=>{
            s.q68_background.destroyChildren();
            s.q68_controller.destroyChildren();
            s.q68_key_buttons.destroyChildren();
        },
        70: ()=>{
            s.q70_question_text.destroyChildren();
            s.q70_button.destroyChildren();
        }
    }


    messageStep(message: Msg) {
        switch (message) {

            case Msg.START:
                // DEBUG
                m.messages.broadcast(Msg.INIT_SHOW_CAUTION);

                break;

            // will call once
            case Msg.INIT_SHOW_CAUTION:
                // start
                s.caution_poster.addChild(new SCautionPoster());
                s.button_continue.addChild(new SButtonContinue());
                s.caution_poster.children[0].enable();
                s.button_continue.children[0].enable();

                s.title.addChild(new STitle());
                s.button_play.addChild(new SButtonPlay());
                s.button_how_to_play.addChild(new SButtonHowToPlay());
                s.button_play_part_link.addChild(new SButtonPlayPartLink());
                s.instruction_poster1.addChild(new SInstructionsPoster1());
                s.instruction_poster2.addChild(new SInstructionsPoster2());
                s.button_back.addChild(new SButtonBack());

                break;

            case Msg.CLOSE_CAUTION:
                s.caution_poster.destroyChildren();
                s.button_continue.destroyChildren();
                break;

            case Msg.SHOW_MENU:
                s.title.children[0].reset1();
                s.button_play.children[0].reset1();
                s.button_how_to_play.children[0].reset1();
                s.button_play_part_link.children[0].reset1();
                this.menuIsClickable = false;

                this.animMoveIn.animationList[0].duration = 1.6;
                break;

            case Msg.SHOW_MENU2:
                s.title.children[0].reset2();
                s.button_play.children[0].reset2();
                s.button_how_to_play.children[0].reset2();
                s.button_play_part_link.children[0].reset2();

                this.animMoveIn.start();
                break;

            case Msg.HIDE_MENU:
                s.title.children[0].disable();
                s.button_play.children[0].disable();
                s.button_how_to_play.children[0].disable();
                s.button_play_part_link.children[0].disable();
                
                this.animMoveIn.animationList[0].duration = 0.8;

                break;


            case Msg.SHOW_INSTRUCTIONS:
                s.instruction_poster1.children[0].reset();
                s.instruction_poster2.children[0].reset();
                s.button_back.children[0].reset();

                this.animMoveIn.start();
                break;

            case Msg.HIDE_INSTRUCTIONS:
                s.instruction_poster1.children[0].disable();
                s.instruction_poster2.children[0].disable();
                s.button_back.children[0].disable();
                break;


            // will call once
            case Msg.INIT_GAME:
                // destroy old objects
                s.button_play.destroyChildren();
                s.button_how_to_play.destroyChildren();
                s.button_play_part_link.destroyChildren();
                s.instruction_poster1.destroyChildren();
                s.instruction_poster2.destroyChildren();
                s.button_back.destroyChildren();

                // create new objects
                for (let i = 0; i < 4; i++) {
                    s.button_choice.addChild(new SButtonChoice(i));
                }
                s.game_background_decoration.addChild(new SGameBackgroundDecoration());
                s.lives_text.addChild(new SLivesText());
                s.lives_number.addChild(new SLivesNumber());
                s.question_text.addChild(new SQuestionText());
                s.question_number.addChild(new SQuestionNumber());
                s.bomb.addChild(new SBomb());
                s.button_next.addChild(new SButtonNext());

                m.messages.broadcast(Msg.START_GAME);
                break;


            case Msg.START_GAME:
                // remove objects
                s.effect_smudge.disable();
                s.effect_explosion.disable();
                s.game_over_poster.disable();
                s.button_play_again.disable();
                s.effect_paint.disable();

                // start game
                this.isGame = true;
                g.question = 31-1;


                g.itemsInSchoolbag.splice(0);
                // DEBUG
                // g.itemsInSchoolbag.push("textbook-1", "exercise_book-1", "textbook-3", "exercise_book-3", "textbook-2", "exercise_book-2", "pen");

                // g.schoolSubjects
                g.schoolSubjects.splice(0);
                {
                    const removedSubject = randomNumber(0, 3);
                    for (let i = 0; i < 4; i++) {
                        if (removedSubject !== i) {
                            g.schoolSubjects.splice(randomNumber(0, g.schoolSubjects.length), 0, i+1);
                        }
                    }
                }

                // DEBUG
                // g.selectedSubject = 1;
                g.selectedSubject = g.schoolSubjects[randomNumber(0, g.schoolSubjects.length-1)];

                g.allowedItems.splice(0);
                g.allowedItems.push("pen", `textbook-${g.selectedSubject}`, `exercise_book-${g.selectedSubject}`);

                S49_DraggableItems.draggingItem = null;
                g.lives = 5;
                this.nextQuestion();
                break;


            case Msg.NEXT_QUESTION:
                soundManager.produce("ding");
                this.invulnerability = 0.3;

                // creation and deletion of special objects happen automatically
                s.misc.destroyChildren();
                s.button_next.children[0].disable();
                
                g.question+=1;

                s.bomb.children[0].begin(g.TIME_BOMBS[g.question] ?? 0);
                
                break;

                
            case Msg.TICK:
                if (this.isGame) {
                    // handle clicks
                    if (this.invulnerability > 0) {
                        this.invulnerability -= m.delta;
                    }
                    if (this.canClick) {
                        m.messages.broadcast(Msg.TICK_GAME_CLICK);
                    }

                    // handle logic
                    m.messages.broadcast(Msg.TICK_GAME_LOGIC);

                    if (this.gameTick) {
                        m.messages.broadcast(Msg.TICK_GAME_BOMB);
                    }
                }
                else {
                    if (this.menuIsClickable) {
                        m.messages.broadcast(Msg.TICK_MENU_CLICK);
                    }
                    m.messages.broadcast(Msg.TICK_MENU_LOGIC);
                }
                break;


            case Msg.PLAY_CLICKED:
                this.menuIsClickable = false;
                this.animPlayClicked.start();

                soundManager.produce("menus:wind");

                break;

            case Msg.PLAY_AGAIN_CLICKED:
                this.menuIsClickable = false;
                this.animPlayAgainClicked.start();
                break;


            case Msg.TICK_MENU_LOGIC:
                this.animMoveIn.simulateTick();
                this.animPlayClicked.simulateTick();
                this.animPlayAgainClicked.simulateTick();
                break;


            case Msg.GAME_COMPLETE:
                this.isGame = false;

                // destroy game objects
                s.button_choice.destroyChildren();
                s.game_background_decoration.destroyChildren();
                s.lives_text.destroyChildren();
                s.lives_number.destroyChildren();
                s.question_text.destroyChildren();
                s.question_number.destroyChildren();
                s.bomb.destroyChildren();
                s.button_next.destroyChildren();

                this.menuIsClickable = false;
                s.game_complete_poster.addChild(new SGameCompletePoster());
                break;
        }
    }
}

class GBackground extends TopContainer {
    constructor() {
        super();
        const g_background = new PIXI.Graphics().rect(0, 0, 480, 360).fill("#ffffff");

        this.addChild(g_background);
    }
}


class SButtonConfigurable extends TopSprite {
    pressed = false;
    focused = false;
    clickable = true;
    clickHitbox: CompMask|CompHitbox;
    
    clickAction: (obj: SButtonConfigurable)=>void;

    readonly clickProcessMessage: Msg;
    textureKeys: {idle: string, pressed?: string};
    tintColors: {idle: string, pressed: string};

    protected tintColorH = "#ffffff";

    constructor(
        p: {
            idle: string,
            x: number,
            y: number,
            anchor?: {x: number, y: number};
            pressed?: string,
            idleTintColor?: string,
            pressedTintColor?: string,
            clickHitboxProps?: HitboxProps|MaskProps
            clickAction?: (obj: SButtonConfigurable)=>void,
            clickProcessMessage?: Msg
        }
    ) {
        super();
        this.textureKeys = {idle: p.idle, pressed: p.pressed};
        this.tintColors = {idle: (p.idleTintColor) ?? "#ffffff", pressed: (p.pressedTintColor) ?? "#808080"};

        this.clickAction = (p.clickAction) ?? (()=>{});
        this.clickProcessMessage = (p.clickProcessMessage) ?? (Msg.TICK);

        // set hitbox
        this.updateVisual();
        if (p.clickHitboxProps && p.clickHitboxProps.matrix) {
            // if the object has a hitbox, then it is a mask
            this.clickHitbox = new CompMask(this, <MaskProps>p.clickHitboxProps);
            this.clickHitbox.calculateOriginPoint();
        }
        else {
            this.clickHitbox = new CompHitbox(this, p.clickHitboxProps);
        }
        this.position.set(p.x, p.y);
        if (p.anchor) {
            this.anchor.set(p.anchor.x, p.anchor.y);
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case this.clickProcessMessage:
                this.clickTick();
                break;
        }
    }

    protected clickTick() {
        if (m.oneFingerIsPressed() && this.clickHitbox.collideFinger(0) && this.clickable) {
            this.pressed = true;
        }
        if (this.pressed) {
            if (!m.fingerIsDown(0)) {
                this.pressed = false;
                if (this.focused) {
                    this.clickAction(this);
                }
            }

            this.focused = this.clickHitbox.collideFinger(0);
        }

        if (this.clickable) {
            this.updateVisual();
        }
    }
    protected updateVisual() {
        let textureKey: string;
        // if the sprite has a texture on press
        if (this.textureKeys.pressed) {
            textureKey = (this.pressed && this.focused) ? this.textureKeys.pressed : this.textureKeys.idle;
        }
        else {
            textureKey = this.textureKeys.idle;
            const tintColor = (this.pressed && this.focused) ? this.tintColors.pressed : this.tintColors.idle;
            if (this.tintColorH !== tintColor) {
                this.tintColorH = tintColor;
                this.tint = tintColor;
            }
        }
        this.changeTextureKeyTick(textureKey);
    }
}

// menu: caution
class SCautionPoster extends TopSprite {
    constructor() {
        super("menus:caution");
        this.anchor.set(0, 0);
        this.disable();
    }
}

class SButtonContinue extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-continue",
            pressed: "menus:button-continue-p",
            x: 240,
            y: 300,
            clickHitboxProps: {offsetX: -128, offsetY: -22, width: 256, height: 37},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                m.messages.broadcast(Msg.CLOSE_CAUTION);
                m.messages.broadcast(Msg.SHOW_MENU);
            }
        });
        this.disable();
    }
}

// menu
class STitle extends TopContainer {
    private s_title1 = new Sprite("title-1");
    private s_title2 = new Sprite("title-2");
    private s_title3 = new Sprite("title-3");
    private s_title1_blurFilter = new PIXI.BlurFilter();
    private s_title2_blurFilter = new PIXI.BlurFilter();
    private s_title3_blurFilter = new PIXI.BlurFilter();

    private animState = 0;

    anim = {
        e1P: new AnimationSequence(()=>{
            this.s_title1.visible = true;
            this.s_title2.visible = false;
            this.s_title3.visible = false;
        })
            .createState({
                duration: 1,
                onStart: ()=>{
                    this.s_title1.x = 240;
                    this.s_title1.position.set(240, 510);
                    this.s_title1.rotation = (Math.PI*-0.15);
                },
                onTick: (t)=>{
                    this.s_title1.y += scale(ease(t.percent, "quadOut"), 0, 1, -800, -80) * m.delta;
                    this.s_title1.rotation += scale(ease(t.percent, "quadOut"), 0, 1, (Math.PI*6), (Math.PI*0.2)) * m.delta;
                }
            })
            .createState({
                offset: 1.0,
                duration: 0.5,
                onTick: (t)=>{
                    this.s_title1.y += (-80)*m.delta;
                    this.s_title1.rotation += (Math.PI*0.2)*m.delta;
                }
            })
            .createState({
                offset: 1.0+0.5,
                duration: 0.8,
                onTick: (t)=>{
                    this.s_title1.y += scale(ease(t.percent, "quadIn"), 0, 1, -80, -1000) * m.delta;
                    this.s_title1.rotation += scale(ease(t.percent, "quadIn"), 0, 1, (Math.PI*0.2), (Math.PI*8)) * m.delta;

                    this.s_title1.alpha = ease(1-t.percent, "quadOut");
                },
                onFinish: ()=>{
                    this.s_title1.visible = false;
                    this.s_title1.alpha = 1;

                    this.s_title2.visible = true;
                    this.s_title2.x = 358;
                }
            })
            .createState({
                offset: 1.0+0.5+0.8,
                duration: 1.3,
                onTick: (t)=>{
                    this.s_title2.y = scale(ease(t.percent, "quadOut"), 0, 1, 360+36, 113+80);
                    this.s_title2.rotation = scale(ease(t.percent, "quadOut"), 0, 1, -Math.PI, 0);
                }
            })
            .createState({
                offset: 1.0+0.5+0.8+1.5,
                duration: 0.8,
                onStart: (t)=>{
                    this.s_title1.visible = true;
                    this.s_title1.position.set(219, -118);
                },
                onTick: (t)=>{
                    this.s_title1.y = scale(ease(t.percent, "quadOut"), 0, 1, -118, 77+80);
                    this.s_title1.rotation = scale(ease(t.percent, "quadOut"), 0, 1, -Math.PI, 0);
                }
            })
            .createState({
                offset: 1.0+0.5+0.8+1.5+0.8,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title3.visible = true;
                    this.s_title3.position.set(245, 159+80);
                    this.s_title3.filters = [this.s_title3_blurFilter];
                    this.s_title3_blurFilter.strength = 0;
                },
                onTick: (t)=>{
                    this.s_title3.alpha = t.percent;
                    this.s_title3.scale.set(scale(ease(t.percent, "quadIn"), 0, 1, 2, 1));
                    this.s_title3_blurFilter.strength = scale(t.percent, 0, 1, 30, 0);

                    if (t.percent >= 1) {
                        this.s_title3.filters = [];
                    }
                }
            })
            .createState({
                offset: 1.0+0.5+0.8+1.5+0.8+1.2,
                duration: 1.6,
                onStart: (t)=>{
                    s.button_play_part_link.children[0].visible = true;
                    s.button_play.children[0].visible = true;
                    s.button_how_to_play.children[0].visible = true;

                    s.main.animMoveIn.start(false, t.time);
                },
                onTick: (t)=>{
                    this.s_title1.y = scale(ease(t.percent, "sineInOut"), 0, 1, 77+80, 77);
                    this.s_title2.y = scale(ease(t.percent, "sineInOut"), 0, 1, 113+80, 113);
                    this.s_title3.y = scale(ease(t.percent, "sineInOut"), 0, 1, 159+80, 159);
                }
            }),

        e2P: new AnimationSequence()
            .createState({
                duration: 0.8,
                onTick: (t)=>{
                    this.y = scale(ease(t.percent, "quadOut"), 0, 1, 0, 80);
                }
            })
            .createState({
                offset: 0.8,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title1.filters = [this.s_title1_blurFilter];
                },
                onTick: (t)=>{
                    this.s_title1.position.set(
                        scale(ease(t.percent, "quadOut"), 0, 1, 219, 219-130),
                        scale(ease(t.percent, "quadOut"), 0, 1, 77, 77-20)
                    );
                    this.s_title1.scale.set(
                        scale(ease(t.percent, "quadOut"), 0, 1, 1, 1.5)
                    );
                    this.s_title1_blurFilter.strength = scale(t.percent, 0, 1, 0, 10);
                }
            })
            .createState({
                offset: 0.8+0.4,
                duration: 0.4,
                onTick: (t)=>{
                    this.s_title1.alpha = 1-t.percent;
                },
                onFinish: ()=>{
                    this.s_title1.visible = false;
                }
            })
            .createState({
                offset: 1.2,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title2.filters = [this.s_title2_blurFilter];
                },
                onTick: (t)=>{
                    this.s_title2.position.set(
                        scale(ease(t.percent, "quadOut"), 0, 1, 358, 358+100),
                        scale(ease(t.percent, "quadOut"), 0, 1, 113, 113-20)
                    );
                    this.s_title2.scale.set(
                        scale(ease(t.percent, "quadOut"), 0, 1, 1, 1.5)
                    );
                    this.s_title2_blurFilter.strength = scale(t.percent, 0, 1, 0, 10);
                }
            })
            .createState({
                offset: 1.2+0.4,
                duration: 0.4,
                onTick: (t)=>{
                    this.s_title2.alpha = 1-t.percent;
                },
                onFinish: ()=>{
                    this.s_title2.visible = false;
                }
            })
            .createState({
                offset: 1.6,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title3.filters = [this.s_title3_blurFilter];
                },
                onTick: (t)=>{
                    this.s_title3.scale.set(
                        scale(ease(t.percent, "quadOut"), 0, 1, 1, 1.5)
                    );
                    this.s_title3_blurFilter.strength = scale(t.percent, 0, 1, 0, 30);
                }
            })
            .createState({
                offset: 1.6+0.4,
                duration: 0.4,
                onTick: (t)=>{
                    this.s_title3.alpha = 1-t.percent;
                },
                onFinish: ()=>{
                    this.s_title3.visible = false;
                    this.destroy();
                }
            })
    };

    private animArray = Object.values(this.anim);

    constructor() {
        super();

        this.s_title1_blurFilter.resolution = dp;
        this.s_title1_blurFilter.strength = 0;
        this.s_title2_blurFilter.resolution = dp;
        this.s_title2_blurFilter.strength = 0;
        this.s_title3_blurFilter.resolution = dp;
        this.s_title3_blurFilter.strength = 0;

        this.s_title1.position.set(219, 77);
        this.s_title2.position.set(358, 113);
        this.s_title3.position.set(245, 159);

        this.addChild(this.s_title3, this.s_title1, this.s_title2);

        this.disable();
    }

    reset1() {
        this.animState = 0;
        this.enable();
        this.anim.e1P.start();
    }
    reset2() {
        this.animState = 2;
        this.enable();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                for (const animEffect of this.animArray) {
                    animEffect.simulateTick();
                }
                break;
        }
    }

    animMoveInTick(t: number) {
        if (this.enabled && this.animState === 2) {
            this.s_title1.position.set(
                scale(ease(t, "quadOut"), 0, 1, -212, 219),
                scale(ease(t, "quadOut"), 0, 1, 77-60, 77)
            );
            this.s_title2.position.set(
                scale(ease(t, "quadOut"), 0, 1, 587, 358),
                scale(ease(t, "quadOut"), 0, 1, 113-60, 113)
            );
            this.s_title3.position.y = (
                scale(ease(t, "quadOut"), 0, 1, 0-20, 159)
            );
            this.s_title3.alpha = t;
        }
    }
}


class SEffectPlainCover extends TopContainer {
    private g_background = new PIXI.Graphics().rect(0, 0, 480, 360).fill("#ffffff");
    
    constructor() {
        super();

        this.addChild(this.g_background);

        this.disable();
    }

    animEffect1 = new AnimationSequence(()=>{
        this.g_background.tint = "#a3825c";
    })
        .createState({
            duration: 1.6,
            onTick: (t)=>{
                this.alpha = t.percent;
            }
        })
    animEffect2 = new AnimationSequence(()=>{
        this.g_background.tint = "#ffffff";
    })
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
            },
            onFinish: ()=>{
                this.disable();
            }
        })

    animPlay() {
        this.enable();
        this.animEffect1.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                this.animEffect1.simulateTick();
                this.animEffect2.simulateTick();
                break;
        }
    }
}


class SButtonPlay extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-play",
            pressed: "menus:button-play-p",
            x: 240,
            y: 265,
            clickHitboxProps: {offsetX: -78, offsetY: -18, width: 156, height: 34},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                m.messages.broadcast(Msg.PLAY_CLICKED);
            }
        });

        this.disable();
    }

    reset1() {
        this.enable();
        this.visible = false;
        this.startY = 265+230;
    }

    reset2() {
        this.enable();
        this.startY = 265+130;
    }

    private startY = 265+130;
    private readonly endY = 265;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = scale(ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

class SButtonHowToPlay extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-how_to_play",
            pressed: "menus:button-how_to_play-p",
            x: 240,
            y: 320,
            clickHitboxProps: {offsetX: -109, offsetY: -18, width: 218, height: 34},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                m.messages.broadcast(Msg.HIDE_MENU);
                m.messages.broadcast(Msg.SHOW_INSTRUCTIONS);
            }
        });

        this.disable();
    }

    reset1() {
        this.enable();
        this.visible = false;
        this.startY = 320+230;
    }

    reset2() {
        this.enable();
        this.startY = 320+130;
    }

    private startY = 320+130;
    private readonly endY = 320;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = scale(ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

class SButtonPlayPartLink extends SButtonConfigurable {
    private eA = document.createElement("a");
    
    constructor() {
        super({
            idle: "menus:button-play_part",
            pressed: "menus:button-play_part-p",
            x: 240,
            y: 199,
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                document.body.appendChild(this.eA);
                this.eA.click();
                document.body.removeChild(this.eA);
            }
        });

        this.disable();

        this.eA.href = "https://pacee4.github.io/dev/games/stunning_quiz_1";
        this.eA.target = "_blank";
        this.eA.rel = "noopener noreferrer";
        this.eA.classList.add("hide");
    }

    reset1() {
        this.enable();
        this.visible = false;
        this.startY = 199+230;
    }

    reset2() {
        this.enable();
        this.startY = 199-220;
    }

    private startY = 199-220;
    private readonly endY = 199;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = scale(ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

class SInstructionsPoster1 extends TopSprite {
    constructor() {
        super("menus:instructions-1");
        this.anchor.set(0, 0);
        this.disable();
    }

    reset() {
        this.enable();
    }

    private readonly startY = -240;
    private readonly endY = 0;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = scale(ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

class SInstructionsPoster2 extends TopContainer {
    private s_text = new Sprite("menus:instructions-2");
    private s_light = new Sprite("menus:instructions-2-light");
    
    constructor() {
        super();
        this.position.set(240, 0);
        this.addChild(this.s_light, this.s_text);

        this.disable();
    }

    reset() {
        this.enable();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                // animation decoration
                this.s_light.rotation += (1.5+Math.sin(m.time*1.5)*0.5)*m.delta;
                this.s_light.scale.x = scale(Math.cos(this.s_light.rotation*2), -1, 1, 0.6, 1);
                this.s_light.scale.y = scale(Math.cos((this.s_light.rotation*2)-Math.PI), -1, 1, 1, 1.4);

                break;
        }
    }

    private readonly startY = 400;
    private readonly endY = 297;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = scale(ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

class SButtonBack extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-back",
            pressed: "menus:button-back-p",
            x: 77,
            y: 323,
            clickHitboxProps: {offsetX: -64, offsetY: -21, width: 129, height: 43},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                m.messages.broadcast(Msg.HIDE_INSTRUCTIONS);
                m.messages.broadcast(Msg.SHOW_MENU2);
            }
        });

        this.disable();
    }

    reset() {
        this.enable();
    }

    private readonly startY = 390;
    private readonly endY = 323;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = scale(ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

// game
class SGameBackgroundDecoration extends TopSprite {
    constructor() {
        super("background_decoration-f1");
        this.anchor.set(0, 0);

        this.new = false;
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.NEXT_QUESTION:
                this.visible = (g.CORRECT_ANSWERS[g.question]!==undefined);
                if (this.visible) {
                    // set position mode by the question whether it has an illustration
                    this.changeTextureKeyTick(
                        (g.ILLUSTRATION_QUESTIONS.indexOf(g.question)!==-1)
                        ? "background_decoration-f2"
                        : "background_decoration-f1"
                    );
                }
                break;
        }
    }
}
class SButtonChoice extends SButtonConfigurable {
    constructor(private readonly id: number) {
        super({
            idle: "button-choice",
            pressed: "button-choice-p",
            x: 0, y: 0,
            clickProcessMessage: Msg.TICK_GAME_CLICK
        });

        this.clickAction = this.clickActionF;
        this.new = false;
    }

    messageStep(message: Msg) {
        super.messageStep(message);
        switch (message) {
            case Msg.NEXT_QUESTION:
                this.pressed = false;
                this.changeTextureKeyTick(this.textureKeys.idle);
                this.visible = (g.CORRECT_ANSWERS[g.question]!==undefined);
                this.clickable = this.visible;
                if (this.visible) {

                    // set position mode by the question whether it has an illustration
                    if ((g.ILLUSTRATION_QUESTIONS.indexOf(g.question)!==-1)) {
                        const x = 126;
                        const y = (this.id * 60) + 103;
                        this.position.set(x, y);
                    }
                    else {
                        const x = (this.id % 2 == 0) ? (126) : (354);
                        const y = (Math.floor(this.id / 2) == 0) ? (201) : (271);
                        this.position.set(x, y);
                    }
                }
                break;
        }
    }

    private clickActionF() {
        if (g.question === 56 && (this.id === 0 || this.id === 1)) {
            s.q56_controller.children[0].requestCamera();
        }
        else {
            if (g.CORRECT_ANSWERS[g.question] === this.id+1) {
                s.main.nextQuestion();
            }
            else {
                s.main.loseLife();
            }
        }
    }
}

class SButtonNext extends SButtonConfigurable {
    constructor() {
        super({
            idle: "button-next",
            pressed: "button-next-p",
            x: 400, y: 330,
            clickProcessMessage: Msg.TICK_GAME_CLICK,
            clickHitboxProps: gatheredAssets.masks["button-next"]
        });

        this.clickAction = this.clickActionF;
        this.new = false;
        
    }

    enable() {
        super.enable();
        this.pressed = false;
        this.changeTextureKeyTick(this.textureKeys.idle);
    }

    private checkQ53() {
        if (s.q53_controller.children[0].checkAnswer()) {
            s.main.nextQuestion();
        }
        else {
            s.main.loseLife();
        }
    }

    private clickActionF() {
        // check
        switch (g.question) {
            case 49:
                S49_Schoolbag.animFinish.start();
                break;
            case 53:
                this.checkQ53();
                break;
            case 68:
                s.q68_controller.children[0].check();
                break;
        }
    }
}

class SLivesText extends TopSprite {
    constructor() {
        super("lives-text");
        this.position.set(95, 333);
    }
}
class SLivesNumber extends TopSprite {

    animLifeLost = new AnimationSequence()
        .createState({
            duration: 0.15,
            onTick: (t)=>{
                this.scale.x = scale(ease(t.percent, "sineOut"), 0, 1, 1, 3.5);
            }
        })
        .createState({
            offset: 0.15,
            duration: 0.35,
            onTick: (t)=>{
                this.scale.x = scale(ease(t.percent, "sineInOut"), 0, 1, 3.5, 1);
            }
        })
        
        .createState({
            duration: 0.2,
            onTick: (t)=>{
                this.scale.y = scale(ease(t.percent, "sineInOut"), 0, 1, 1, 3);
            }
        })
        .createState({
            offset: 0.2,
            duration: 0.3,
            onTick: (t)=>{
                this.scale.y = scale(ease(t.percent, "sineInOut"), 0, 1, 3, 1);
            }
        });
        

    constructor() {
        super();
        this.position.set(201, 336);
        this.new = false;
    }

    effectLifeLost() {
        this.changeTextureKey(`lives-${g.lives}`);
        this.animLifeLost.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.START_GAME:
                this.changeTextureKey(`lives-${g.lives}`);
                break;

            case Msg.TICK:
                this.animLifeLost.simulateTick();
                break;
        }
    }
}

class SQuestionText extends TopSprite {
    constructor() {
        super();
        this.anchor.set(0, 0);
        this.position.set(0, 0);
        this.new = false;

        // DEBUG
        this.visible = false;
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.NEXT_QUESTION:
                this.changeTextureKey(`question-${g.question}`);
                if (gatheredAssets.textures[`question-${g.question}`]) {
                    this.visible = true;
                }
                else {
                    this.visible = false;
                }
                break;
        }
    }
}

class SQuestionNumber extends TopContainer {
    s_circle = new Sprite("question_number-circle");
    s_number = new Sprite();
    constructor() {
        super();
        this.position.set(39, 39);
        this.new = false;

        this.addChild(this.s_circle, this.s_number);
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.NEXT_QUESTION:
                if (this.visible) {
                    this.s_number.changeTextureKey(`question_number-${g.question}`);
                }
                break;
        }
    }
}

class SEffectSmudge extends TopContainer {
    animEffect = new AnimationSequence(()=>{
        this.g_smudge.tint = "#6b00a6";
        this.g_smudge.scale.set(0);
    })
        .createState({
            duration: 0.6,
            onTick: (t)=>{
                this.g_smudge.scale.set(ease(t.percent, "sineOut") * 1.75);
            }
        })
        
        .createState({
            offset: 0.3,
            duration: 0.7,
            onTick: (t)=>{
                this.g_smudge.tint = getColorFromGradient(["#6b00a6", "#3e0066"], ease(t.percent, "sineInOut"));

                if (t.time >= 0.2) {
                    s.game_over_poster.animEffect.startOnce();
                }
            }
        })
        .createState({
            offset: 0.3 + 0.7,
            duration: 0.5,
            onTick: (t)=>{
                if (t.time >= 0.5) {
                    s.button_play_again.animEffect.startOnce();
                }
            }
        });

    g_smudge = new PIXI.Graphics().svg(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   version="1.1"
   width="480"
   height="360"
   viewBox="0 0 480 360"
   id="svg10"
   xml:space="preserve"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:cc="http://creativecommons.org/ns#"><defs
     id="defs10" /><g
     id="layer12"
     style="display:inline;opacity:1"><g
       id="g211"
       style="display:inline;fill:#ffffff"><path
         id="rect1"
         style="display:inline;fill:#ffffff;fill-opacity:1;stroke-width:3.17665;stroke-linecap:round"
         d="m 0,127.99243 c 0,0 51.008754,-81.567 86.503326,-81.09687 13.633674,0.23506 -20.450515,114.946 23.741404,97.78637 37.37508,-14.57393 91.67472,-120.58752 127.16929,-119.17714 64.64244,2.5857 -39.25558,66.52294 31.4985,77.80599 33.84913,5.40645 112.59536,-84.1527 159.60804,-50.06851 73.57484,53.12433 64.17231,129.51993 -2.11557,115.88626 -49.83344,-10.10773 -105.07333,3.52595 -115.18106,26.09203 -10.34279,22.80115 9.87266,84.38776 61.11648,75.45535 60.41129,-10.34279 63.70218,-17.62975 70.98915,36.19976 C 442.85943,339.54949 416.0622,360 416.0622,360 H 0 Z" /></g></g></svg>
<!--rotationCenter:319.99999999999955:180-->

`);
    g_mask = new PIXI.Graphics().rect(0, 0, screen.LOGICAL_WIDTH, screen.LOGICAL_HEIGHT).fill("#ffffff");

    constructor() {
        super();
        this.disable();
    }

    reset() {
        this.enable();

        this.g_smudge.pivot.set(0, screen.LOGICAL_HEIGHT);
        this.g_smudge.position.set(0, screen.LOGICAL_HEIGHT);
        
        this.g_smudge.mask = this.g_mask;
        this.addChild(this.g_smudge, this.g_mask);

        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch(message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}


class SGameOverPoster extends TopContainer {
    animEffect = new AnimationSequence()
        .createState({
            duration: 0.8,
            onStart: (t)=>{
                this.s_light.visible = true;
            },
            onTick: (t)=>{
                const v = scale(ease(t.percent, "sineOut"), 0, 1, 0, 1);
                this.s_light.scale.set(v);
                this.s_light.alpha = v;
            }
        })

        .createState({
            offset: 0.5,
            duration: 0.4,
            onStart: (t)=>{
                this.s_text.visible = true;
            },
            onTick: (t)=>{
                this.s_text.scale.set(scale(ease(t.percent, "sineOut"), 0, 1, 0, 1.25));
            }
        })
        .createState({
            offset: 0.5+0.4,
            duration: 0.4,
            onTick: (t)=>{
                this.s_text.scale.set(scale(ease(t.percent, "sineInOut"), 0, 1, 1.25, 1));
            }
        });

    s_text = new Sprite("menus:game_over");
    s_light = new Sprite("menus:game_over-light");
    
    constructor() {
        super();
        this.position.set(240, 96);
        this.addChild(this.s_light, this.s_text);

        this.disable();
    }

    reset() {
        this.enable();
        this.s_text.visible = false;
        this.s_light.visible = false;
        this.animEffect.canStart = true;
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                this.animEffect.simulateTick();
                break;
        }
    }
}

class SButtonPlayAgain extends SButtonConfigurable {

    private scaleH = 0;

    animEffect = new AnimationSequence()
        .createState({
            duration: 0.4,
            onStart: ()=>{
                this.visible = true;
                this.scale.set(0);
            },
            onTick: (t)=>{
                this.scale.set(scale(ease(t.percent, "sineOut"), 0, 1, 0, 1.25));
            },
            onFinish: ()=>{
                s.main.menuIsClickable = true;
            }
        })
        .createState({
            offset: 0.4,
            duration: 0.4,
            onTick: (t)=>{
                this.scale.set(scale(ease(t.percent, "sineInOut"), 0, 1, 1.25, 1));
            }
        })

    animEffect2 = new AnimationSequence(()=>{
        this.scaleH = this.scale.x; // retrieve the scale transformation
    })
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.scale.set(scale(ease(t.percent, "sineIn"), 0, 1, this.scaleH, 0));
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super({
            idle: "menus:button-play_again",
            pressed: "menus:button-play_again-p",
            x: 240,
            y: 320,
            clickHitboxProps: {offsetX: -147, offsetY: -24, width: 294, height: 47},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                m.messages.broadcast(Msg.PLAY_AGAIN_CLICKED);
            }
        });
        this.disable();
    }

    reset() {
        this.enable();
        this.visible = false;
        this.animEffect.canStart = true;

        s.main.menuIsClickable = false;
    }

    messageStep(message: Msg) {
        super.messageStep(message);
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                this.animEffect.simulateTick();
                this.animEffect2.simulateTick();
                break;
        }
    }
}

class SBomb extends TopContainer {
    s_bomb = new Sprite();
    s_time = new Sprite();
    timeLeft = 0;
    timeLeftIH = 0;

    constructor() {
        super();
        this.s_bomb.pivot.set(-6, 6);

        this.position.set(440, 40);

        this.addChild(this.s_bomb, this.s_time);
    }

    begin(seconds: number) {
        s.main.gameTick = true;
        this.timeLeft = seconds;
        this.timeLeftIH = seconds;
        if (this.timeLeftIH > 0) {
            this.visible = true;
            this.emitClockTick();
        }
        else {
            this.visible = false;
        }
            
    }
    emitClockTick() {
        // a second has passed
        this.s_time.changeTextureKey(`time_bomb-${this.timeLeftIH}`);
        if (this.timeLeftIH > 0) {
            if (this.timeLeftIH > 3) {
                soundManager.produce("tick");
            }
            else {
                soundManager.produce("beep");
            }

            if (this.timeLeftIH > 5) {
                this.s_time.tint = "#ffffff";
            }
            else if (this.timeLeftIH > 3) {
                this.s_time.tint = "#ffee00";
            }
        }
        else {
            if (s.main.gameTick) {
                s.main.explode();
            }
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                // animation decoration
                if (this.visible) {
                    this.s_bomb.changeTextureKeyTick(`bomb-f${ Math.floor(m.time*6)%4+1 }`);
                    this.s_bomb.scale.set( Math.sin(m.time*2.5)*0.065+1 );
                }
                break;

            case Msg.TICK_GAME_BOMB:
                if (this.visible) {
                    this.timeLeft -= m.delta;

                    // flash
                    if (this.timeLeftIH <= 3) {
                        const pulse = (this.timeLeftIH === 1) ? 30 : 15;
                        this.s_time.tint = (Math.floor(this.timeLeft*pulse)%2 === 0) ? "#ffee00" : "#ff0000";
                    }

                    // timer
                    if (Math.ceil(this.timeLeft) < this.timeLeftIH) {
                        this.timeLeftIH = Math.ceil(this.timeLeft);
                        this.emitClockTick();
                    }
                }
                break;
        }
    }
}

class SEffectExplosion extends TopContainer {
    gameOverCalled = false;
    animEffect = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.g_explosion.scale.set(ease(t.percent, "sineOut")*10);
                
                if (t.time >= 0.4 && !this.gameOverCalled) {
                    s.main.gameOver(true);
                    this.gameOverCalled = true;
                }
            }
        });

    g_explosion = new PIXI.Graphics()
        .svg(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg
        version="1.1"
        width="128.25"
        height="121.5"
        viewBox="0 0 128.25 121.5"
        id="svg10"
        xml:space="preserve"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:svg="http://www.w3.org/2000/svg"
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xmlns:cc="http://creativecommons.org/ns#"><defs
            id="defs10" /><g
            id="layer12"
            style="display:inline;opacity:1"><g
            id="g210"
            style="display:inline"><g
                id="g195"
                style="display:inline;fill:#ff903e;fill-opacity:1"><path
                style="fill:#ff903e;fill-opacity:1;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"
                d="M 424.5,43 426,15.5 443.5,39 452,13 l 8.5,33.25 33.5,-22.5 -18.75,29 29.5,-1.25 -28.9186,16.582117 27.42185,16.422496 L 473.75,81.25 499,100 469.52037,93.334124 485.28768,127.45846 461,101.25 l -13.5,32.25 -5.75,-35.25 -13.5,36.25 -1,-36 -36.5,22.75 L 415,84.5 376.5,67 415,61.75 l -28,-35 z"
                id="path179" /><path
                style="fill:#ffd561;fill-opacity:1;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"
                d="m 432,52 -1.75,-24.25 14.5,28 6.75,-24.5 7,23 L 479,37.5 465.75,59.5 493.5,55.75 472.29754,67.078729 487.53108,79.386486 466.5,79 489,95.25 463.98371,88.279173 473.99904,111.10739 458,94.75 l -8.75,27 L 443,92.25 432,115 433,91.25 404.75,108.5 426,80.5 395,69.5 422.25,62.5 403,37.75 Z"
                id="path209" /><path
                style="fill:#fff9cf;fill-opacity:1;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"
                d="m 433.75,58 -0.25,-17.75 11.75,20.25 6.5,-18.5 3.5,19.5 15.75,-15 -8.25,16.5 15.5,-3.25 -15.20246,11.078729 17.73354,6.307757 L 464,79 480,91 459.98371,84.029173 467.49904,102.35739 455,88.25 l -4.5,21.5 -4.75,-23.5 -10.75,15.5 V 85.25 L 419.75,94.5 432.5,78.25 408.25,70.75 433,67.5 419.75,50.25 Z"
                id="path210" /></g></g></g></svg>
        `);

    g_mask = new PIXI.Graphics().rect(0, 0, screen.LOGICAL_WIDTH, screen.LOGICAL_HEIGHT).fill("#ffffff");

    constructor() {
        super();
        this.disable();
    }

    reset() {
        this.gameOverCalled = false;

        this.enable();

        this.g_explosion.pivot.set(440+5, 40+25);
        this.g_explosion.position.set(440, 40);

        this.g_explosion.mask = this.g_mask;
        this.addChild(this.g_explosion, this.g_mask);

        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch(message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

class SEffectPaint extends TopContainer {
    private s_paint = new Sprite("effect-paint");
    private g_fill = new PIXI.Graphics().rect(-480, 0, 480+1, 360).fill("#ffffff");

    private readonly startX = -274;
    private readonly endX = 480;

    private animEffect = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.x = scale(ease(t.percent, "quadOut"), 0, 1, this.startX, this.endX);
            }
        });
    
    constructor() {
        super();
        this.s_paint.anchor.set(0, 0);

        this.position.set(0, 0);
        
        this.addChild(this.g_fill, this.s_paint);

        this.disable();
    }

    /** play the effect */
    animPlay() {
        this.enable();
        this.animEffect.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}


// QUESTION 36
class S36_Controller extends TopContainer {
    private animFinish = new AnimationSequence().createState({
        duration: 0.6,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });

    static getX(side: "left"|"right") {
        return (side==="left") ? (130) : (350);
    }
    static getY(pos: number) {
        return 100+pos*60;
    }

    clickedElement: S36_Elements|null = null; // reference to an object
    activeLine: S36_Lines|null = null; // reference to an object
    private connectsMade = 0;
    connectingByHolding = false;

    constructor() {
        super();
    }

    clickLogic(element: S36_Elements) {
        const prev = this.clickedElement;

        if (prev === element) {
            // discard
            this.discard(element);
        }
        else if (!prev || prev.side === element.side) {
            if (prev) {
                // delete old line
                prev.connecting = false;
                this.activeLine?.destroy();
            }
            // create a new line
            this.activeLine = new S36_Lines(
                S36_Controller.getX(element.side),
                S36_Controller.getY(element.pos)
            );
            s.q36_lines.addChild(this.activeLine);
            
            element.connecting = true;
            this.clickedElement = element;
        }
        else {
            // connect has made
            this.connect(prev, element);
        }
    }

    private connect(prev: S36_Elements, element: S36_Elements) {
        prev.connecting = false;
        element.connecting = false;
        
        let wrong = false;
        if (prev.id === element.id) {
            prev.connected = true;
            element.connected = true;
            
            this.connectsMade++;

            if (this.connectsMade === 4) {
                s.main.gameTick = false;
                this.animFinish.start();
            }
        }
        else {
            wrong = true;
            this.activeLine?.animRed.start();
            prev.animRed.start();
            element.animRed.start();
            s.main.loseLife();
        }

        this.activeLine?.attach(
            S36_Controller.getX(element.side),
            S36_Controller.getY(element.pos),
            wrong
        );

        this.clickedElement = null;
    }
    private discard(prev: S36_Elements) {
        prev.connecting = false;
        this.activeLine?.destroy();
        this.clickedElement = null;
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                if (this.connectingByHolding) {
                    if (!m.fingerIsDown(0)) {
                        // find the element that touches mouse
                        this.connectingByHolding = false;
                        if (this.clickedElement) {
                            const secondElement = s.q36_elements.children.find((element)=>(
                                element.clickHitbox.collidePoint(m.mouseX, m.mouseY) && element.side !== this.clickedElement?.side
                            ));

                            if (secondElement) {
                                // connect
                                this.connect(this.clickedElement, secondElement);
                            }
                            else {
                                // discard
                                this.discard(this.clickedElement);
                            }
                        }
                    }
                }
                this.animFinish.simulateTick();
                break;
        }
    }
}

class S36_Elements extends TopContainer {
    private s_base = new Sprite("36:element-base");
    private readonly s_outline = new Sprite("36:element-outline");
    private readonly s_emoji = new Sprite();

    clickHitbox = new CompHitbox(this, {offsetX: -25, offsetY: -25, width: 50, height: 50});
    pressed = false;
    focused = false;
    connecting = false;
    connected = false;

    private tintColorHolder = "#ffffff";
    animRed = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.s_base.tint = getColorFromGradient(["#ff0000", "#ffffff"], t.percent);
            }
        });

    // the first element can connect to the second one

    constructor(public id: number, public pos: number, public side: "left"|"right") {
        super();
        this.s_emoji.scale.set(0.3);
        this.s_emoji.changeTextureKey( "36:" 
            + String(id+1) 
            + (side==="left" ? "a" : "b")
        );

        this.position.set(S36_Controller.getX(side), S36_Controller.getY(pos));

        this.addChild(this.s_base, this.s_emoji, this.s_outline);
    }

    tickClick() {
        if (m.oneFingerIsPressed() && this.clickHitbox.collideFinger(0)) {
            this.animRed.playing = false;
            this.pressed = true;
        }
        if (this.pressed) {
            if (!m.fingerIsDown(0)) {
                if (this.focused) {
                    s.q36_controller.children[0].clickLogic(this);
                }
                this.pressed = false;
                return;
            }

            this.focused = this.clickHitbox.collideFinger(0);

            if (!this.focused && !s.q36_controller.children[0].clickedElement) {
                this.pressed = false;
                s.q36_controller.children[0].connectingByHolding = true;
                s.q36_controller.children[0].clickLogic(this);
            }
        }
    }

    messageStep(message: Msg): void {
        switch(message) {
            case Msg.TICK_GAME_CLICK:
                if (!this.connected) {
                    this.tickClick();
                }

                const tintColor = (
                    (this.connecting) ? (
                        (this.pressed) ? "#008000" : "#00ff00"
                    )
                    : (
                        (this.pressed) ? "#808080" : "#ffffff"
                    )
                );
                if (tintColor !== this.tintColorHolder) {
                    this.tintColorHolder = tintColor;
                    this.s_base.tint = tintColor;
                }

                this.animRed.simulateTick();
                break;

        }
    }
}

class S36_Lines extends TopContainer {
    connected = false;

    g_line = new PIXI.Graphics();

    animRed = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
            },
            onFinish: ()=>{
                this.destroy();
            }
        });

    constructor(public startX: number, public startY: number) {
        super();
        this.addChild(this.g_line);
    }

    private drawLineTo(x: number, y: number, red=false) {
        this.g_line.clear();
        this.g_line
            .moveTo(this.startX, this.startY)
            .lineTo(x, y)
            .stroke({
                width: 6, 
                color: ((red) ? "#ff0000" : "#000000"),
                cap: "round"
            });
    }

    attach(x: number, y: number, wrong=false) {
        this.drawLineTo(x, y, wrong);
        this.connected = true;
        if (wrong) {
            this.animRed.start();
        }
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                if (!this.connected) {
                    this.drawLineTo(m.mouseX, m.mouseY);
                }
                this.animRed.simulateTick();
                break;
        }
    }
}




class SSpriteImage extends TopSprite {
    constructor(textureKey: string, p: {
        x: number,
        y: number,
        tint?: PIXI.ColorSource,
        scale?: number
    }) {
        super(textureKey);
        this.position.set(p.x, p.y);

        if (p.tint) this.tint = p.tint;
        if (p.scale) this.scale.set(p.scale);
    }
}


// QUESTION 40
//#region 
class S40_Controller extends TopContainer {
    currentColorId = 0;
    playing = false;
    correctAnswers = 0;
    private animFinish = new AnimationSequence().createState({
        duration: 0.6,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });

    constructor() {
        super();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                if (this.playing) {
                    s.q40_buttons.children.forEach((e)=>{e.cGameTick();});
                    s.q40_string.children[0].cGameTick();
                }
                this.animFinish.simulateTick();
                break;
        }
    }

    startGame() {
        this.playing = true;
        s.q40_string.children[0].visible = true;
        this.runString();
    }
    endGame() {
        this.playing = false;
        s.q40_string.children[0].visible = false;
    }
    runString() {
        if (this.correctAnswers < 10) {
            this.currentColorId = randomNumber(0, 7);
            s.q40_string.children[0].runString(this.currentColorId);
            s.main.invulnerability = 0.3;
        }
        else {
            this.endGame();
            this.animFinish.start();
        }
    }

    correctAnswer() {
        this.correctAnswers++;

        soundManager.produce("40:correct");
        this.runString();
    }
    wrongAnswer() {
        s.q40_buttons.children.forEach((e)=>{e.pressed = false;});
        s.q40_red_frame.children[0].beginAnim();
        
        s.main.loseLife();
        if (g.lives === 0) {
            this.endGame();
        }
        else {
            this.runString();
        }
    }
}

class S40_BackgroundCover extends TopSprite {
    constructor() {
        super("40:background");
        this.anchor.set(0, 0);
    }
}

class S40_Screen extends TopSprite {
    constructor() {
        super("40:screen");
        this.anchor.set(0, 0);
        this.position.set(30, 20);
    }
}

class S40_ScreenFlash extends TopSprite {

    private animEffect = new AnimationSequence()
        .createState({
            duration: 0.6,
            onStart: ()=>{
                this.visible = true;
            },
            onTick: (t)=>{
                this.alpha = (1-t.percent);
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super();
        this.anchor.set(0, 0);
        this.position.set(30, 20);

        this.visible = false;
    }

    beginAnim(colorId: number) {
        this.changeTextureKey(`40:${S40_Buttons.COLOR_NAMES[colorId]}_flash`);
        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

class S40_RedFrame extends TopSprite {
    private animEffect = new AnimationSequence(()=>{
        this.visible = true;
    })
        .createState({
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = t.percent;
            }
        })
        .createState({
            offset: 0.3,
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = (1-t.percent);
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super("40:red_frame");
        this.anchor.set(0, 0);
        this.position.set(0, 0);

        this.visible = false;
    }

    beginAnim() {
        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

class S40_Buttons extends TopSprite {
    static readonly COLOR_NAMES: ReadonlyArray<string> = [
        "red", "orange", "yellow", "green", "light_blue", "blue", "purple", "white"
    ];
    static readonly COLOR_CODES: ReadonlyArray<string> = [
        "#E93A3A", "#FA8C18", "#FCEF29", "#32B000", "#39AEF4", "#202DD9", "#AB41EF", "#F0F0F0"
    ]

    clickHitbox: CompHitbox;
    pressed = false;
    focused = false;
    
    constructor(public colorId: number) {
        super(`40:${S40_Buttons.COLOR_NAMES[colorId]}`);

        this.position.set(58+colorId*52, 280);
        this.clickHitbox = new CompHitbox(this);
    }

    cGameTick() {
        if (s.main.canClick) {
            if (m.oneFingerIsPressed() && this.clickHitbox.collideFinger(0)) {
                this.pressed = true;
            }
            if (this.pressed) {
                if (!m.fingerIsDown(0)) {
                    if (this.focused) {
                        this.clickAction();
                    }
                    this.pressed = false;
                }

                this.focused = this.clickHitbox.collideFinger(0);
            }

            this.tint = (this.pressed && this.focused) ? "#808080" : "#ffffff";
        }
    }

    private clickAction() {
        s.q40_screen_flash.children[0].beginAnim(this.colorId);
        if (this.colorId === s.q40_controller.children[0].currentColorId) {
            s.q40_controller.children[0].correctAnswer();
        }
        else {
            s.q40_controller.children[0].wrongAnswer();
        }
    }
}

class S40_String extends TopSprite {
    readonly LEFT_CORNER = 33;
    readonly RIGHT_CORNER = 447;
    leftCorner = 0;
    rightCorner = 0;
    time = 0;
    duration = 3;

    constructor() {
        super();
        this.visible = false;
    }

    runString(colorId: number) {
        this.changeTextureKey(`40:string-${colorId}`);

        this.leftCorner = this.LEFT_CORNER-(this.width/2);
        this.rightCorner = this.RIGHT_CORNER+(this.width/2);

        this.position.set(this.rightCorner, randomNumber(55, 215));

        this.tint = S40_Buttons.COLOR_CODES[randomNumber(0, 7)];

        this.time = 0;
    }

    cGameTick() {
        this.time += m.delta;
        this.x = scale(this.time, 0, this.duration, this.rightCorner, this.leftCorner);
        if (this.time > this.duration) {
            s.q40_controller.children[0].wrongAnswer();
        }
    }
}

class S40_FadeTip extends TopSprite {
    blurFilter = new PIXI.BlurFilter();

    anim = new AnimationSequence(()=>{
        this.alpha = 0;
        this.blurFilter.strengthX = 0;
        this.blurFilter.strengthY = 30;
        this.blurFilter.resolution = dp;
    })
        .createState({
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = t.percent;
                this.blurFilter.strengthY = (1-t.percent)*30;
            },
        })
        .createState({
            offset: 0.3+2.4,
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
                this.blurFilter.strengthY = t.percent*30;
            },
            onFinish: ()=>{
                s.q40_controller.children[0].startGame();
                soundManager.produce("40:start_game");
                this.destroy();
            }
        });

    constructor() {
        super("40:tip");
        this.position.set(240, 135);

        this.filters = [this.blurFilter];

        this.anim.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.anim.simulateTick();
                break;
        }
    }
}
//#endregion


// QUESTION 44
class S44_BeginText extends TopSprite {
    constructor() {
        super("44:begin_text");
        this.anchor.set(0, 0);
    }

    static showMaze() {
        s.q44_begin_text.children[0].visible = false;
        s.q44_begin_point.children[0].visible = false;
        s.q44_maze.children[0].visible = true;
        s.q44_maze_text.children[0].animDisappear.stop();
        s.q44_maze_text.children[0].alpha = 1;
        s.q44_maze_text.children[0].visible = true;
        s.q44_maze_text.children[0].animDisappear.canStart = true;
    }
    static hideMaze() {
        s.q44_maze.children[0].visible = false;
        if (g.lives !== 0) {
            s.q44_begin_text.children[0].visible = true;
            s.q44_begin_point.children[0].visible = true;
            if (s.q44_maze_text.children[0].visible) {
                s.q44_maze_text.children[0].animDisappear.startOnce();
            }
        }
    }
}
class S44_BeginPoint extends TopSprite {
    clickHitbox = new CompHitbox(this);

    constructor() {
        super("44:begin_point");
        this.position.set(248, 288);
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                if (m.oneFingerIsPressed() && this.clickHitbox.collideFinger(0)) {
                    S44_BeginText.showMaze();
                }
                break;
        }
    }
}
class S44_MazeText extends TopSprite {
    animDisappear = new AnimationSequence()
        .createState({
            duration: 1,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super("44:maze_text");
        this.anchor.set(0, 0);

        this.visible = false;
    }

    messageStep(message: Msg): void {
        switch(message) {
            case Msg.TICK_GAME_LOGIC:
                this.animDisappear.simulateTick();
                break;
        }
    }
}
class S44_Maze extends TopContainer {
    private s_room = new Sprite("44:maze_room");
    private s_spinner = new Sprite("44:maze_spinner");
    private collision: CompMask;
    private collision_spinner: CompMask;
    
    constructor() {
        super();
        this.s_room.anchor.set(0, 0);

        this.collision = new CompMask(this, gatheredAssets.masks["44:maze_collision"]);
        this.collision_spinner = new CompMask(this.s_spinner, gatheredAssets.masks["44:maze_spinner_collision"]);
        this.collision_spinner.calculateOriginPoint();

        this.s_spinner.position.set(360, 156);

        this.addChild(this.s_spinner, this.s_room);
    }
    
    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                if (this.visible) {
                    // collision

                    const spinnerPos = rotatePoint(m.mouseX, m.mouseY, this.s_spinner.rotation, this.s_spinner.x, this.s_spinner.y);

                    // hide maze text
                    if (m.mouseY <= 191) {
                        s.q44_maze_text.children[0].animDisappear.startOnce();
                    }

                    // finish area
                    if (m.mouseY <= 30) {
                        s.main.nextQuestion();
                    }

                    // safe area
                    else if (
                        !(!m.isMobile || m.fingerIsDown(0)) && (m.mouseY >= 258)
                    ) {
                        S44_BeginText.hideMaze();
                    }

                    // dangerous area
                    else if (
                        !(!m.isMobile || m.fingerIsDown(0))
                        || this.collision.collidePoint(m.mouseX, m.mouseY)
                        || this.collision_spinner.collidePoint(spinnerPos.x, spinnerPos.y)
                    ) {
                        s.main.loseLife();
                        S44_BeginText.hideMaze();
                    }

                    // logic
                    this.s_spinner.rotation -= (3/Math.PI)*m.delta;
                }
                
                break;
        }
    }
}

// QUESTION 45
class S45_Controller extends TopContainer {
    private shufflesLeft=0;
    canPick = false;

    anim1 = new AnimationSequence()
        // open all chests
        .createState({
            duration: 1.5,
            onStart: ()=>{
                s.q45_chests.children.forEach((sp)=>{sp.openChest();});
            },
            onFinish: ()=>{
                soundManager.produce("45:close");
                s.q45_chests.children.forEach((sp)=>{sp.closeChest();});
            }
        })
        // close all chests
        .createState({
            offset: 1.5,
            duration: 0.2,
            onFinish: ()=>{
                this.anim2.start();
            }
        });
    
    anim2 = new AnimationSequence(()=>{
        this.shuffleChests();
    })
        // shuffle chests
        .createState({
            duration: 0.5,
            onTick: (t)=>{
                s.q45_chests.children.forEach((sp)=>{sp.tickAnimMove(t)});
                if (t.percent === 1) {
                    if (this.shufflesLeft > 0) {
                        this.anim2.start();
                    }
                    else {
                        this.canPick = true;
                        s.q45_text.children[0].visible = true;
                    }
                }
            }
        });
        
    animEmptyChestOpened = new AnimationSequence(()=>{
        soundManager.produce("45:open");
    })
        .createState({
            duration: 0.5,
            onFinish: ()=>{
                s.main.loseLife();
                this.startShuffleChests();
            }
        });
    animTreasureChestOpened = new AnimationSequence(()=>{
        soundManager.produce("45:treasure");
    })
        .createState({
            duration: 1,
            onFinish: ()=>{
                s.main.nextQuestion();
            }
        });



    startShuffleChests() {
        this.shufflesLeft = 8;
        this.anim1.start();
    }

    private shuffleChests() {
        this.anim2.animationList[0].duration = ((this.shufflesLeft===8) ? 1/2 : 1/3);
        this.shufflesLeft -= 1;

        let sourceI = randomNumber(0, 2);
        let toI;
        do {
            toI = randomNumber(0, 2);
        } while (sourceI===toI);

        s.q45_chests.children.forEach((sp)=>{
            sp.moving = false;
            if (sp.i===sourceI) {
                sp.beginAnimMove(toI);
            }
            else if (sp.i===toI) {
                sp.beginAnimMove(sourceI, true);
            }
        });
    }

    constructor() {
        super();
    }

    messageStep(message: Msg) {
        switch (message) {

            case Msg.TICK_GAME_LOGIC:
                this.anim1.simulateTick();
                this.anim2.simulateTick();
                this.animEmptyChestOpened.simulateTick();
                this.animTreasureChestOpened.simulateTick();
                break;
        }
    }
}

class S45_Chests extends TopContainer {
    s_chest;
    i; moving=false; movingDown=false;
    toX=0; previousX=0;

    clickMask;

    constructor(i: number, private containsTreasure=false) {
        super();
        this.i = i;

        this.s_chest = new Sprite("45:chest-closed");
        this.s_chest.anchor.set(0.5);

        this.addChild(this.s_chest);

        this.position.set(
            screen.LOGICAL_WIDTH/2 - 130 + (this.i*130),
            screen.LOGICAL_HEIGHT/2
        );

        this.clickMask = new CompMask(this, gatheredAssets.masks["45:chest-closed"]);
        this.clickMask.calculateOriginPoint();
    }

    // commands
    openChest() {
        this.s_chest.changeTextureKey(
            (this.containsTreasure) ? "45:chest-open_with_treasure" : "45:chest-open"
        );
    }

    closeChest() {
        this.s_chest.changeTextureKey("45:chest-closed");
    }

    beginAnimMove(toI: number, moveDown=false) {
        this.moving = true;
        this.movingDown = moveDown;
        this.i = toI;
        this.previousX = this.x;
        this.toX = screen.LOGICAL_WIDTH/2 - 130 + (this.i*130);
    }

    endAnimMove() {
        if (this.moving) {
            this.moving = false;
            this.position.set(
                this.toX,
                screen.LOGICAL_HEIGHT/2
            );
        }
    }

    tickAnimMove(t: AnimationTimeProperties) {
        if (this.moving) {
            let y = (
                (t.percent > 0.5)
                ? ease(scale(t.percent, 0, 0.5, 0, 1), "quadOut")*(this.movingDown?120:-120) + screen.LOGICAL_HEIGHT/2
                : ease(scale(t.percent, 0.5, 1, 1, 0), "quadOut")*(this.movingDown?120:-120) + screen.LOGICAL_HEIGHT/2
            );

            this.position.set(
                scale(t.percent, 0, 1, this.previousX, this.toX),
                y
            );
        }
    }

    pressed = false;
    focused = false;
    tintColorHolder = "#ffffff";

    private tickClick() {
        if (m.oneFingerIsPressed() && this.clickMask.collideFinger(0)) {
            this.pressed = true;
        }
        if (this.pressed) {
            if (!m.fingerIsDown(0)) {
                if (this.focused) {
                    this.clickAction();
                }
                this.pressed = false;
            }

            this.focused = this.clickMask.collideFinger(0);
        }

        const tintColor = (this.pressed && this.focused) ? "#808080" : "#ffffff";
        if (tintColor !== this.tintColorHolder) {
            this.tintColorHolder = tintColor;
            this.tint = tintColor;
        }
    }

    private clickAction() {
        s.q45_controller.children[0].canPick = false;
        s.q45_text.children[0].visible = false;
        this.openChest();
        if (this.containsTreasure) {
            s.q45_controller.children[0].animTreasureChestOpened.start();
        }
        else {
            s.q45_controller.children[0].animEmptyChestOpened.start();
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                if (s.q45_controller.children[0].canPick) {
                    this.tickClick();
                }
                break;
        }
    }
}

class S45_Text extends TopSprite {
    constructor() {
        super("45:text-1");
        this.position.set(0, 0);
        this.anchor.set(0, 0);
        this.visible = false;
    }
}

// QUESTION 49
class S49_DraggableItems extends TopSprite {
    clickHitbox: CompHitbox;
    clickable = true;

    startGrabRelX = 0;
    startGrabRelY = 0;

    pressed = false;

    /** allows only one item to be dragged */
    static draggingItem: S49_DraggableItems|null = null;

    constructor(public readonly item: string, x: number, y: number, dragging=false){
        super("49:"+item);
        // Question 49: collect items into a schoolbag
        // Question 55: take items from the schoolbag

        this.position.set(x, y);

        this.clickHitbox = new CompHitbox(this);

        if (dragging) {
            S49_DraggableItems.draggingItem = this;
        }
    }

    

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:

                // drag
                if (this.clickable) {
                    if (m.oneFingerIsPressed() && this.clickHitbox.collideFinger(0)) {
                        S49_DraggableItems.draggingItem = this;
                    }

                    if (this.pressed) {
                        if (!m.fingerIsDown(0)) {
                            this.pressed = false;
                            S49_DraggableItems.draggingItem = null;

                            if (g.question === 55) {
                                    // put the item on the desk
                                    this.position.set(
                                        clamp(this.x, 91, 418),
                                        clamp(this.y, 216, 278)
                                    );
                                }
                            if (this.clickHitbox.collide(s.q49_schoolbag.children[0].dropHitbox)) {
                                s.q49_schoolbag.children[0].drop(this);
                            }

                            if (g.question === 55) {
                                S49_Schoolbag.checkQ55();
                            }
                        }
                        else {
                            // dragging
                            this.position.set(
                                clamp(this.startGrabRelX+m.mouseX, 0, 480),
                                clamp(this.startGrabRelY+m.mouseY, 0, 360)
                            );
                        }
                    }
                }
                break;

            case Msg.TICK_GAME_LOGIC:
                if (S49_DraggableItems.draggingItem === this && !this.pressed) {
                    this.pressed = true;
                        
                    s.q49_draggable_items.children.forEach((sp)=>{if (sp!==this) sp.zIndex = 0;});
                    this.zIndex = 1;
                    s.q49_draggable_items.sortChildren();

                    this.startGrabRelX = this.x-m.mouseX;
                    this.startGrabRelY = this.y-m.mouseY;
                }
                break;
        }
    }
}

class S49_Schoolbag extends TopContainer {
    static animFinish = new AnimationSequence(()=>{
        s.main.gameTick = false;
        s.q49_schoolbag.children[0].close();
    })
        .createState({
            duration: 1,
            onFinish: ()=>{ s.main.nextQuestion(); }
        });

    dropHitbox = new CompHitbox(this, {offsetX: 57-90, offsetY: 87-90, width: 66, height: 50});
    extractHitbox = new CompHitbox(this, {offsetX: 35-90, offsetY: 45-90, width: 110, height: 100});

    s_schoolbag_left = new Sprite();
    s_schoolbag_right = new Sprite();

    aboutToExtract = false;

    isOpen;

    constructor(){
        super();
        // Question 49: collect items into a schoolbag
        // Question 55: take items from the schoolbag

        if (g.question === 49) {
            this.position.set(97, 240);
            this.isOpen = true;
        }
        else {
            this.position.set(109, 219);
            this.isOpen = false;
        }

        this.addChild(this.s_schoolbag_left, this.s_schoolbag_right);
        layers[0].attach(this.s_schoolbag_left);

        this.updateVisual();
    }

    updateVisual() {
        if (this.isOpen) {
            this.s_schoolbag_right.visible = true;
            this.s_schoolbag_left.changeTextureKeyTick("49:schoolbag-1-open");
            if (g.itemsInSchoolbag.length > 0) {
                this.s_schoolbag_right.changeTextureKeyTick("49:schoolbag-2-full");
            }
            else {
                this.s_schoolbag_right.changeTextureKeyTick("49:schoolbag-2-empty");
            }
            
        }
        else {
            this.s_schoolbag_right.visible = false;
            this.s_schoolbag_left.changeTextureKeyTick("49:schoolbag-closed");
        }
    }

    drop(draggableItem: S49_DraggableItems) {
        if (this.isOpen) {
            g.itemsInSchoolbag.push(draggableItem.item);
            draggableItem.destroy();
            
            this.updateVisual();

            soundManager.produce("49:wool");
        }
    }

    extract() {
        const item = g.itemsInSchoolbag.pop();
        if (item) {
            s.q49_draggable_items.addChild(new S49_DraggableItems(
                item, m.mouseX, m.mouseY, true
            ))
            this.updateVisual();

            soundManager.produce("49:wool");

            return true;
        }

        return false;
    }

    open() {
        if (!this.isOpen) {
            this.isOpen = true;
            this.updateVisual();

            soundManager.produce("49:zipper");
        }
    }

    close() {
        if (this.isOpen) {
            this.isOpen = false;
            this.updateVisual();

            soundManager.produce("49:zipper");
        }
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                if (m.oneFingerIsPressed() && this.extractHitbox.collideFinger(0)) {
                    if (this.isOpen) {
                        this.aboutToExtract = true;
                    }
                    else {
                        this.open();
                    }
                }
                break;

            case Msg.TICK_GAME_LOGIC:
                if (this.aboutToExtract) {
                    if (!S49_DraggableItems.draggingItem) {
                        this.extract();
                    }
                    this.aboutToExtract = false;
                }

                S49_Schoolbag.animFinish.simulateTick();

                break;

            case Msg.SHOW_GAME_OVER:
                layers[0].detach(this.s_schoolbag_left);
                break;
        }
    }

    static checkQ55() {
        const currentItems = s.q49_draggable_items.children.map(sp => sp.item);

        // check if array must contain only these specific values
        if (
            g.allowedItems.length === currentItems.length
            && g.allowedItems.every((item) => currentItems.includes(item))
        ) {
            s.q55_question_text.children[0].animDisappear.start();
            S49_Schoolbag.animFinish.start();
        }
    }
}


// QUESTION 50 (don't touch)
class S50_ArrowLevel extends TopContainer {
    readonly GRID_WIDTH = 7;
    readonly GRID_HEIGHT = 7;
    escapedArrows = 0;

    grid!: Uint8Array;
    constructor() {
        super();

        // pick random level
        this.createLevel([
            "0823160939981923313331915111122122721639290898130",
            "0931160233293619127152116921311111239582290929270",
            "0211190573113539189119322131112336171261920996390",
            "0963130893292359292613121821299231123227330773190"
        ][randomNumber(0, 3)]);
    }


    createLevel(levelCode: string) {
        // fill the grid from the level code
        this.grid = new Uint8Array(this.GRID_WIDTH*this.GRID_HEIGHT);
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = parseInt(levelCode[i], 10);
        }

        // apply grid transformation randomly
        if (randomNumber(0, 1)) this.mirrorHorizontal();
        if (randomNumber(0, 1)) this.mirrorVertical();
        if (randomNumber(0, 1)) this.rotate90();


        // decoration
        {
            const g = new PIXI.Graphics();
            for (let i = 0; i < this.grid.length; i++) {
                if (this.grid[i]!==0) {
                    const x = (screen.LOGICAL_WIDTH-((this.GRID_WIDTH-1) * CArrow.SIZE))/2 + ((i%this.GRID_WIDTH) * CArrow.SIZE);
                    const y = (screen.LOGICAL_HEIGHT-((this.GRID_HEIGHT-1) * CArrow.SIZE))/2 + (Math.floor(i/this.GRID_WIDTH) * CArrow.SIZE) - 10;
                    g.circle(x, y, 3);
                }
            }
            g.fill("#e0e0e0");
            this.addChild(g);
        }


        // then create arrows
        for (let i = 0; i < this.grid.length; i++) {
            if (S50_ArrowLevel.isPoint(this.grid[i])) {
                this.addChild(new CArrow(this, i, S50_ArrowLevel.convertToDirection(this.grid[i])));
            }
        }
    }

    static isPoint(number: number) {
        return number >= 5 && number <= 8;
    }
    static convertToDirection(number: number): number {
        return number-5;
    }
    static convertDirectionToXY(direction: number, multiplier: number) {
        if (direction===0) { // up
            return {x: 0, y: -multiplier};
        }
        else if (direction===2) { // down
            return {x: 0, y: multiplier};
        }
        else if (direction===3) { // left
            return {x: -multiplier, y: 0};
        }
        else { // right
            return {x: multiplier, y: 0};
        }
    }
    static oppositeDirection(direction: number): number {
        return remainder(direction+2, 4);
    }

    mirrorHorizontal() {
        // BELOW CODE GENERATED BY AI
        for (let i = 0; i < this.grid.length; i += this.GRID_WIDTH) {
            this.grid.subarray(i, i + this.GRID_WIDTH).reverse();
        }
        
        // change data
        for (let i = 0; i < this.grid.length; i++) {
            const number = this.grid[i];
            if (number === 6) { // right-left
                this.grid[i] = 8;
            }
            else if (number === 8) { // left-right
                this.grid[i] = 6;
            }
            else if (number === 2) { // turn right-turn left
                this.grid[i] = 3;
            }
            else if (number === 3) { // turn left-turn right
                this.grid[i] = 2;
            }
        }
    }
    mirrorVertical() {
        // BELOW CODE GENERATED BY AI
        const result = new Uint8Array(this.GRID_WIDTH*this.GRID_HEIGHT);

        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            const sourceRow = this.grid.subarray(y * this.GRID_WIDTH, (y + 1) * this.GRID_WIDTH);
            result.set(sourceRow, (this.GRID_HEIGHT - 1 - y) * this.GRID_WIDTH);
        }

        this.grid = result;

        // change data
        for (let i = 0; i < this.grid.length; i++) {
            const number = this.grid[i];
            if (number === 5) { // up-down
                this.grid[i] = 7;
            }
            else if (number === 7) { // down-up
                this.grid[i] = 5;
            }
            else if (number === 2) { // turn right-turn left
                this.grid[i] = 3;
            }
            else if (number === 3) { // turn left-turn right
                this.grid[i] = 2;
            }
        }
    }
    rotate90() {
        // BELOW CODE GENERATED BY AI
        const result = new Uint8Array(this.GRID_WIDTH*this.GRID_HEIGHT);

        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                // source index
                const oldIndex = y * this.GRID_WIDTH + x;
                
                // new coordinates after rotation
                const newX = (this.GRID_HEIGHT - 1) - y;
                const newY = x;
                
                // new index
                const newIndex = newY * this.GRID_HEIGHT + newX;
                
                result[newIndex] = this.grid[oldIndex];
            }
        }

        this.grid = result;

        // change data
        for (let i = 0; i < this.grid.length; i++) {
            const number = this.grid[i];
            if (S50_ArrowLevel.isPoint(number)) { // rotate direction by 90
                this.grid[i] = remainder((number - 5)+1, 4) + 5;
            }
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                (this.children).forEach((sp)=>{
                    if (sp instanceof CArrow) {
                        sp.tick();
                    }
                });
                break;
        }
    }
}
class CArrow extends PIXI.Container {
    static readonly SIZE = 32;

    g: PIXI.Graphics;
    i;
    endDirection: number;
    trail: number[];

    private collidableGroup = new CompGroup(this);

    private reachDistance = 0;
    private offset = 0;
    private animState: "idle"|"going"|"goingBack" = "idle";
    private animLifetimeOffset = 0;
    private animLifetimeColor = 0;
    private animColor = "#404850";

    private isLastArrow = false;

    constructor(readonly p: S50_ArrowLevel, i: number, endDirection: number) {
        super();

        this.i = i;
        this.endDirection = endDirection;
        const col = i%this.p.GRID_WIDTH;
        const row = Math.floor(i/this.p.GRID_WIDTH);

        this.trail = [];
        {
            let movingI = this.i;
            let movingDirection = S50_ArrowLevel.oppositeDirection(this.endDirection);

            while (true) {
                movingI = this.moveI(movingI, movingDirection);

                let data = this.p.grid[movingI]; // data may be turn, start or end
                if (data===0 || data > 3) { 
                    break; // exit the loop
                }
                
                this.trail.push(data);

                if (data===2) {
                    // turn right
                    movingDirection = remainder(movingDirection+1, 4);
                }
                if (data===3) {
                    // turn left
                    movingDirection = remainder(movingDirection-1, 4);
                }
            }
        }


        this.g = new PIXI.Graphics();
        
        this.position.set(
            (screen.LOGICAL_WIDTH-((this.p.GRID_WIDTH-1) * CArrow.SIZE))/2 + (col * CArrow.SIZE),
            (screen.LOGICAL_HEIGHT-((this.p.GRID_HEIGHT-1) * CArrow.SIZE))/2 + (row * CArrow.SIZE) - 10
        )
        
        this.addChild(this.g);

        this.drawTrail(0, true);
    }

    
    moveI(currentI: number, direction: number) {
        if (direction === 0) { // up
            currentI -= this.p.GRID_WIDTH;
            if (currentI < 0) {
                return -1;
            }
        }
        else if (direction === 2) { // down
            currentI += this.p.GRID_WIDTH;
            if (currentI >= this.p.GRID_WIDTH*this.p.GRID_HEIGHT) {
                return -1;
            }
        }
        else if (direction === 3) { // left
            currentI -= 1;
            if (remainder(currentI, this.p.GRID_WIDTH) === this.p.GRID_WIDTH-1) {
                return -1;
            }
        }
        else if (direction === 1) { // right
            currentI += 1;
            if (remainder(currentI, this.p.GRID_WIDTH) === 0) {
                return -1;
            }
        }
        return currentI;
    }
    drawTrail(offset: number, needToCreateHitboxes=false) {
        let movingDirection = S50_ArrowLevel.oppositeDirection(this.endDirection);

        const offsetXY = S50_ArrowLevel.convertDirectionToXY(this.endDirection, offset*CArrow.SIZE);
        
        const drawLine = ()=>{
            if (remainingLength>0) {
                const linePiece = CArrow.SIZE * Math.min(remainingLength, 1);

                if (movingDirection===0) { // up
                    penY -= linePiece;
                }
                else if (movingDirection===2) { // down
                    penY += linePiece;
                }
                else if (movingDirection===3) { // left
                    penX -= linePiece;
                }
                else if (movingDirection===1) { // right
                    penX += linePiece;
                }
                this.g.lineTo(penX, penY);
                remainingLength--;

                // create child hitbox
                if (needToCreateHitboxes) this.collidableGroup.group.push(new CompHitbox(this, {offsetX: penX-CArrow.SIZE/2, offsetY: penY-CArrow.SIZE/2, width: CArrow.SIZE, height: CArrow.SIZE}));
            }
        };
        
        let remainingLength = (this.trail.length+1)-offset;
        
        let penX = (this.endDirection===3) 
            ? Math.min(remainingLength*CArrow.SIZE, 0)
            : (this.endDirection===1)
            ? Math.max(-remainingLength*CArrow.SIZE, 0)
            : 0;
        let penY = (this.endDirection===0) 
            ? Math.min(remainingLength*CArrow.SIZE, 0)
            : (this.endDirection===2)
            ? Math.max(-remainingLength*CArrow.SIZE, 0)
            : 0;

        // if the butt is outside the screen, destroy this object
        if (this.x+penX < 0 
            || this.x+penX > screen.LOGICAL_WIDTH
            || this.y+penY < 0 
            || this.y+penY > screen.LOGICAL_HEIGHT
        )
        {
            this.destroyItself();
            return;
        }


        this.g.clear();
        // arrow
        this.g
            .rotateTransform(this.endDirection*Math.PI/2)
            .translateTransform(offsetXY.x, offsetXY.y)
            .poly([0,-8, -8,8, 8,8], true)
            .fill(this.animColor)
            .stroke({color: this.animColor,width:4,join:"round"})
            .resetTransform();
        // trail
        this.g.moveTo(offsetXY.x, offsetXY.y);
        this.g.lineTo(penX, penY);
        if (needToCreateHitboxes) this.collidableGroup.group.push(new CompHitbox(this, {offsetX: penX-CArrow.SIZE/2, offsetY: penY-CArrow.SIZE/2, width: CArrow.SIZE, height: CArrow.SIZE}));

        if (!(remainingLength<=0)) {
            drawLine();
            for (let turn of this.trail) {
                if (remainingLength<=0) {
                    break;
                }

                if (turn===2) {
                    // turn right
                    movingDirection = remainder(movingDirection+1, 4);
                }
                else if (turn===3) {
                    // turn left
                    movingDirection = remainder(movingDirection-1, 4);
                }

                drawLine();
            }
        }
        // stroke
        this.g.stroke({color: this.animColor, width: 6, join: "round", cap: "round"});
    }
    destroyItself() {
        if (this.isLastArrow) {
            s.main.nextQuestion();
        }
        this.destroy(true);
    }

    freeDataOnGrid() {
        let movingI = this.i;
        let movingDirection = S50_ArrowLevel.oppositeDirection(this.endDirection);
        
        this.p.grid[movingI] = 0;
        for (let turn of this.trail) {
            movingI = this.moveI(movingI, movingDirection);
            this.p.grid[movingI] = 0;


            if (turn===2) {
                // turn right
                movingDirection = remainder(movingDirection+1, 4);
            }
            if (turn===3) {
                // turn left
                movingDirection = remainder(movingDirection-1, 4);
            }
        }
        movingI = this.moveI(movingI, movingDirection);

        this.p.grid[movingI] = 0;
    }

    tick() {
        // if an arrow is clicked
        if (this.collidableGroup.collideFinger(0) && m.fingerIsPressed(0) && this.animState==="idle") {
            this.launchArrow();
        }

        let finalRefresh = false;

        // offset tick
        if (this.animState==="going") {
            this.offset += 15 * m.delta;
            if (this.offset > this.reachDistance && this.reachDistance !== 0) {
                s.main.loseLife();
                s.main.invulnerability = 0;

                this.animState = "goingBack";
                this.animLifetimeOffset = 0.3;
                this.animLifetimeColor = 0.5;
            }
        }
        if (this.animState==="goingBack") {
            this.animLifetimeOffset -= m.delta;
            if (this.animLifetimeOffset <= 0) {
                this.animLifetimeOffset = 0;
                this.animState = "idle";
                finalRefresh = true;
            }

            this.offset = scale(ease(this.animLifetimeOffset/0.3, "cubicIn"), 1, 0, this.reachDistance, 0);
        }

        // color tick
        if (this.animLifetimeColor > 0) {
            this.animLifetimeColor -= m.delta;
            if (this.animLifetimeColor <= 0) {
                this.animLifetimeColor = 0;
                finalRefresh = true;
            }

            this.animColor = getColorFromGradient(["#404850", "#ff0000", "#404850"], scale(this.animLifetimeColor, 0.5, 0, 0, 1));
        }

        // animation tick
        if (this.animState!=="idle" || this.animLifetimeColor > 0 || finalRefresh) {
            // it can also destroy itself when it is off screen
            this.drawTrail(this.offset);
        }
    }

    launchArrow() {
        let movingI = this.i;
        let distance = 1;
        let canEscape = false;

        while (true) {
            movingI = this.moveI(movingI, this.endDirection);

            // if the arrow can leave boundary
            if (movingI===-1) {
                canEscape = true;
                break;
            }
            // check for obstacles
            if (this.p.grid[movingI]!==0) {
                break;
            }
            // keep going
            distance++;
        }
        if (!canEscape) {
            this.reachDistance = distance-0.2;
        }
        else {
            this.reachDistance = 0;

            this.p.escapedArrows++;
            if (this.p.escapedArrows === 8) {
                this.isLastArrow = true;
                s.main.gameTick = false;
            }
            this.freeDataOnGrid();
            soundManager.produce("50:arrow-let-go");
        }

        this.animState = "going";
    }

}


// QUESTION 51
class S51_BeanAndController extends TopContainer {
    private animShake = new AnimationSequence()
        .createState({
            duration: 0.05,
            onTick: (t)=>{
                const shakeP = (this.reverse) ? (-this.shakeAdditionP) : (this.shakeAdditionP);
                const shake = (this.reverse) ? (-this.shakeAddition) : (this.shakeAddition);
                const scaleX = scale(t.percent, 0, 1, 1+shakeP, 1-shake);
                const scaleY = scale(t.percent, 0, 1, 1-shakeP, 1+shake);
                this.s_bean.scale.set(scaleX, scaleY);
            },
            onFinish: (t)=>{
                this.shakeAdditionP = this.shakeAddition;
                if (this.shakeAdditionP > 0.000001) {

                    this.shakeAddition -= 0.02;
                    if (this.shakeAddition < 0) {
                        this.shakeAddition = 0;
                    }

                    this.reverse = !this.reverse;
                    this.animShake.start(false, t.totalTime-t.duration);
                }
                else {
                    this.s_bean.scale.set(1);
                    this.animFinish.start(false, t.totalTime-t.duration);
                }
            }
        });

    private animFadeIn = new AnimationSequence().createState({
        duration: 0.25,
        onTick: (t)=>{
            this.s_bean.alpha = t.percent;
        },
    });
    
    private animFinish = new AnimationSequence().createState({
        duration: 0.6,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });

    s_bean = new Sprite("51:bean");
    shakeAdditionP = 0;
    shakeAddition = 0;
    reverse = false;

    s_word = new Sprite();

    stepN = 0;

    constructor() {
        super();
        this.position.set(252, 296);

        this.s_bean.visible = false;

        this.addChild(this.s_bean, this.s_word);
    }

    processClick(clickedI: number): boolean {
        if (this.stepN===0) {
            if (clickedI===3) {
                this.stepN=1;

                this.s_word.changeTextureKey("51:word-1");
                soundManager.produce("51:piano-F");

                return true;
            }
            else {
                s.main.loseLife();
                return false;
            }
        }
        else {
            if (clickedI===4) {
                this.s_word.changeTextureKey("51:word-2");
                soundManager.produce("51:piano-G");

                s.main.gameTick = false;

                // begin repeating animation
                this.reverse = false;
                this.s_bean.visible = true;
                this.shakeAdditionP = 0.3;
                this.shakeAddition = this.shakeAdditionP;
                this.shakeAddition -= 0.02;
                this.animFadeIn.start();

                this.animShake.start();
                return true;
            }
            else {
                s.main.loseLife();
                return false;
            }
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.animFadeIn.simulateTick();
                this.animShake.simulateTick();
                this.animFinish.simulateTick();
                break;
        }
    }
}


class S53_Controller extends TopContainer {
    static readonly CORRECT_ORDERS = ["123456", "213456", "124356", "214356", "654321", "654312", "653421", "653412"];

    constructor() {
        super();
    }

    checkAnswer(): boolean {
        for (let i = 0; i < 6; i++) {
            const gottenID = s.q53_draggable_items.children.find((sp)=>(sp.pos === i))!.id;
            let hasMatch = false;
            for (const correctOrder of S53_Controller.CORRECT_ORDERS) {
                if (correctOrder[i] === String(gottenID)) {
                    hasMatch = true;
                    break;
                }
            }
            if (!hasMatch) {
                // the order is incorrect
                return false;
            }
        }
        // the order is correct
        return true;
    }
}

class S53_DraggableItems extends TopContainer {
    private s_button = new Sprite("53:draggable_item");
    private s_label: Sprite;
    private clickHitbox = new CompHitbox(this, {offsetX: -101, offsetY: -15, width: 203, height: 30});

    private clickable = true;
    private pressed = false;
    private startGrabRelY = 0;
    private prevY = 0;
    private targetY = 0;


    private animMoveToPos = new AnimationSequence(()=>{
        this.prevY = this.y;
        this.targetY = 138+(this.pos*30);
        if (this.prevY === this.targetY) {
            this.animMoveToPos.stop();
        }
        else {
            this.clickable = false;
        }
    })
        .createState({
            duration: 0.6,
            onTick: (t)=>{
                this.y = scale(ease(t.percent, "quadOut"), 0, 1, this.prevY, this.targetY);
                if (t.percent >= 1) {
                    this.clickable = true;
                }
            }
        })

    

    constructor(public pos: number, public id: number) {
        super();

        this.s_label = new Sprite(`53:label-${id}`);

        this.position.set(240, 138+(pos*30));

        this.addChild(this.s_button, this.s_label);
    }

    private tickClick() {
        if (this.clickable) {
            if (m.oneFingerIsPressed() && this.clickHitbox.collideFinger(0)) {
                this.pressed = true;
                s.q53_draggable_items.children.forEach((sp)=>{if (sp!==this) sp.zIndex = 0;});
                this.zIndex = 1;
                s.q53_draggable_items.sortChildren();

                this.startGrabRelY = this.y-m.mouseY;
            }
            if (this.pressed) {
                
                if (!m.fingerIsDown(0)) {
                    this.pressed = false;
                    this.animMoveToPos.start();
                }
                else {
                    // dragging
                    this.y = clamp(this.startGrabRelY+m.mouseY, 138, 288);

                    const actualPos = Math.round((this.y-138)/30);
                    if (this.pos !== actualPos) {
                        // this item has moved to another position index
                        const sideN = Math.sign(this.pos - actualPos);

                        s.q53_draggable_items.children.filter((sp)=>(
                            isBetween(sp.pos, this.pos-sideN, actualPos)
                            && sp !== this
                        )).forEach((sp)=>{
                            sp.pos += sideN;
                            sp.animMoveToPos.start();
                        });

                        this.pos = actualPos;
                    }
                }
            }
        }


        // update visual
        this.s_button.changeTextureKeyTick(this.pressed ? ("53:draggable_item-p") : ("53:draggable_item"));
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                this.tickClick();
                break;

            case Msg.TICK_GAME_LOGIC:
                this.animMoveToPos.simulateTick();
                break;
        }
    }
}


// QUESTION 55
class S55_Background extends TopSprite {
    constructor() {
        super("55:background");
        this.anchor.set(0, 0);
        this.position.set(0, 0);
    }
}

class S55_QuestionText extends TopSprite {
    animDisappear = new AnimationSequence()
        .createState({
            duration: 0.6,
            onTick: (t)=>{ this.alpha = 1-t.percent; },
            onFinish: ()=>{ this.visible = false; }
        });

    constructor() {
        super("question-55-q");
        this.anchor.set(0, 0);
        this.position.set(0, 0);
    }
}


// QUESTION 56
class S56_Controller extends TopContainer {
    videoSource = false;

    constructor() {
        super();
    }

    requestCamera() {
        // if there is no video source, create one
        if (!this.videoSource) {
            s.main.gameTick = false;

            navigator.mediaDevices.getUserMedia({video: {
                facingMode: "user", 
                aspectRatio: {ideal: 4/3},
                width: {max: 1440},
                height: {max: 1080}
            }})
                .then((stream)=>{
                    const video = new S56_Background(stream);
                    s.q56_background.addChild(video);
                    this.videoSource = true;
                    return video.play();
                })
                .then(()=>{
                    s.q56_question_text.removeChildAt(0).destroy();
                    s.main.gameTick = true;
                })
                .catch(()=>{
                    s.main.gameTick = true;
                    s.main.loseLife();
                });
        }
        
        else {
            s.main.loseLife();
        }
}
}

class S56_QuestionText extends TopSprite {
    constructor() {
        super("question-56-q");
        this.anchor.set(0, 0);
        this.position.set(0, 0);
    }
}

class S56_Background extends TopContainer {
    elVideo = document.createElement("video");

    constructor(stream: MediaStream) {
        super();

        this.elVideo.muted = true;
        this.elVideo.srcObject = stream;
    }

    async play() {
        await this.elVideo.play();
        
        const s_videoSource = new PIXI.VideoSource({resource: this.elVideo});
        const s_texture = new PIXI.Texture({source: s_videoSource});
        const s_sprite = new PIXI.Sprite(s_texture);
        this.addChild(s_sprite);

        s_sprite.scale.set(screen.LOGICAL_HEIGHT/s_sprite.height);
        s_sprite.anchor.set(0.5);
        s_sprite.position.set(screen.LOGICAL_WIDTH/2, screen.LOGICAL_HEIGHT/2);
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                break;
            case Msg.SHOW_GAME_OVER:
                // destroy the video source as well
                this.destroy(true);
                break;
        }
    }
}


// QUESTION 60
class S60_Volleyball extends TopContainer {
    animPump = new AnimationSequence(()=>{
        this.elasticity++;
        this.prevScaleX = this.scale.x;
        this.prevScaleY = this.scale.y;
        this.prevAlpha = this.s2.alpha;

        if (this.elasticity >= 25) {
            console.log("pumped up");
            s.q60_pump.children[0].letGo();
            s.main.gameTick = false;
            this.animRoll.start();
        }
    })
        .createState({
            duration: 0.5,
            onTick: (t)=>{
                this.scale.set(
                    scale(ease(t.percent, "sineInOut"), 0, 1, this.prevScaleX, scale(this.elasticity, 0, 25, 1.4, 1)),
                    scale(ease(t.percent, "sineInOut"), 0, 1, this.prevScaleY, scale(this.elasticity, 0, 25, 0.2, 1))
                );
                this.s2.alpha = scale(t.percent, 0, 1, this.prevAlpha, scale(this.elasticity, 0, 25, 0, 1));
            }
        });

    animRoll = new AnimationSequence()
        .createState({
            offset: 1,
            duration: 1,
            onStart: (t)=>{
                this.s1.anchor.y = 0.5;
                this.s1.y -= this.s1.height/2;
            },
            onTick: (t)=>{
                this.s1.rotation = scale(t.percent, 0, 1, 0, Math.PI*1.5);
                this.x = scale(t.percent, 0, 1, 161, 161-(149*1.5));
            },
            onFinish: ()=>{
                s.main.nextQuestion();
            }
        });

    s1 = new Sprite("60:volleyball-1");
    s2 = new Sprite("60:volleyball-2");
    s3 = new Sprite("60:volleyball-3");

    prevScaleX = 0;
    prevScaleY = 0;
    prevAlpha = 0;

    elasticity = 0;
    
    constructor() {
        super();
        this.s1.anchor.set(0.5, 1);
        this.s2.anchor.set(0.5, 1);
        this.s3.anchor.set(0.5, 1);

        this.position.set(161, 291);
        this.addChild(this.s1, this.s2, this.s3);

        // initial state
        this.scale.set(1.4, 0.2);
        this.s2.alpha = 0;
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                this.animPump.simulateTick();
                this.animRoll.simulateTick();
                break;
        }
    }
}

class S60_Pump extends TopContainer {
    animLetGo = new AnimationSequence(()=>{
        this.prevY = this.s_press.y;
    })
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.s_press.y = scale(ease(t.percent, "quadOut"), 0, 1, this.prevY, 0);
            }
        });
    
    s_case = new Sprite("60:pump-case");
    s_press = new Sprite("60:pump-press");
    clickHitbox = new CompHitbox(this.s_press, {offsetX: 306, offsetY: 79, width: 88, height: 30});
    constructor() {
        super();
        this.s_case.anchor.set(0, 0);
        this.s_press.anchor.set(0, 0);

        this.addChild(this.s_press, this.s_case);
    }

    private startGrabRelY = 0;
    private prevY = 0;

    private pressed = false;

    private canPump = true;

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                if ((!this.pressed) && m.fingerIsPressed(0) && this.clickHitbox.collideFinger(0)) {
                    this.pressed = true;
                    this.startGrabRelY = this.s_press.y-m.mouseY;
                    this.animLetGo.stop();
                }
                if (this.pressed) {
                    if (!m.fingerIsDown(0)) {
                        this.pressed = false;
                        this.animLetGo.start();
                    }
                    else {
                        // dragging
                        this.s_press.y = clamp(this.startGrabRelY+m.mouseY, 0, 75);

                        if (this.s_press.y >= 75 && this.canPump) {
                            this.canPump = false;
                            soundManager.produce("60:inflate");
                            s.q60_volleyball.children[0].animPump.start();
                        }
                    }
                }
                break;

            case Msg.TICK_GAME_LOGIC:
                if (this.s_press.y <= 0 && !this.canPump) {
                    this.canPump = true;
                }
                this.animLetGo.simulateTick();
                break;
        }
    }

    letGo() {
        this.pressed = false;
        this.animLetGo.start();
    }
}



// QUESTION 63
class S63_Controller extends TopContainer {
    step!: number;
    aboutToWin!: boolean;
    clickedMatches: S63_Matches[] = [];

    private animFinish = new AnimationSequence().createState({
        duration: 2,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });
    
    constructor() {
        super();
        this.init();
    }

    init() {
        this.step = 0;
        this.aboutToWin = true;
        this.clickedMatches.splice(0); // clear
    }

    processClick(match: S63_Matches) {
        this.step++;
        this.clickedMatches.push(match);
        if (this.aboutToWin && !match.correct) this.aboutToWin = false;

        if (this.step===2) {
            if (this.aboutToWin) {
                s.main.gameTick = false;
                for (const match of this.clickedMatches) {
                    match.animDisappear.start();
                }
                this.animFinish.start();
            }
            else {
                for (const match of this.clickedMatches) {
                    match.animRed.start();
                }
                this.init();
                s.main.loseLife();
            }
        }
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                this.animFinish.simulateTick();
                break;
        }
    }
}
class S63_Matches extends SButtonConfigurable {
    constructor(x: number, y: number, direction: number, public readonly correct=false) {
        super({
            idle: "63:match",
            x: x, y: y,
            clickProcessMessage: Msg.TICK_GAME_CLICK,
            clickHitboxProps: {offsetX: -7, offsetY: -28, width: 14, height: 56}
        });
        this.clickAction = this.clickActionF;

        this.rotation = direction*(Math.PI/2);
        if (direction % 2 === 1) {
            this.clickHitbox.setHitbox({
                offsetX: this.clickHitbox.offsetY,
                offsetY: this.clickHitbox.offsetX,
                width: this.clickHitbox.height,
                height: this.clickHitbox.width
            });
        }
    }

    private clickActionF() {
        this.alpha = 0.25;
        this.clickable = false;
        this.updateVisual();
        s.q63_controller.children[0].processClick(this);
    }

    animRed = new AnimationSequence(()=>{
        this.alpha = 1;
        this.clickable = true;
    })
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.tint = getColorFromGradient(["#ff0000", "#ffffff"], t.percent);
            }
        });
    animDisappear = new AnimationSequence()
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.alpha = scale(t.percent, 0, 1, 0.25, 0);
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    messageStep(message: Msg): void {
        super.messageStep(message);
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                this.animRed.simulateTick();
                this.animDisappear.simulateTick();
                break;
        }
    }
}

// QUESTION 65
class S65_QuestionContent extends TopContainer {
    constructor() {
        super();
        const t_question = new SmoothText({
            text: "\u26ab\ufe0f\u2754\ud83d\udc26\ud83d\udcaa\ud83d\udeab\u2708\u2753",
            x: 250,
            y: 60,
            anchor: 0.5, style: {fontFamily: "sans-serif", fontSize: 36},
        });

        const t_answers: SmoothText[] = [];
        {
            const answers = ["\ud83d\udc27", "\u2708\ud83d\udc69\u200d\u2708", "\ud83e\udd87", "\ud83d\ude9c"];
            for (let i = 0; i < 4; i++) {
                t_answers.push(new SmoothText({
                    text: answers[i],
                    x: (i % 2 == 0) ? (126) : (354),
                    y: (Math.floor(i / 2) == 0) ? (200) : (270),
                    anchor: 0.5, style: {fontFamily: "sans-serif", fontSize: 36},
                }));
            }
        }

        this.addChild(t_question, ...t_answers);
    }
}


// QUESTION 68
class S68_Background extends TopContainer {
    private s_background = new Sprite("68:background");
    private s_exercise_book = new Sprite(isBetween(g.selectedSubject, 1, 2) ? "68:exercise_book-1" : "68:exercise_book-3");
    private s_bottom = new Sprite("68:bottom_cover");

    animGetExerciseBook = new AnimationSequence()
        .createState({
            duration: 0.6,
            onTick: (t)=>{
                this.s_exercise_book.y = scale(ease(t.percent, "quadOut"), 0, 1, 140, 0);
            }
        });
    
    constructor() {
        super();

        this.s_background.anchor.set(0, 0);
        this.s_exercise_book.anchor.set(0, 0);
        this.s_bottom.anchor.set(0, 0);

        this.addChild(this.s_background, this.s_exercise_book, this.s_bottom);

        this.animGetExerciseBook.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                this.animGetExerciseBook.simulateTick();
                break;
        }
    }
}
class S68_Controller extends TopContainer {
    private readonly acceptableWord = ["глагол","повесть","уравнение","губернатор"][g.selectedSubject-1];
    
    private writtenWord = "";
    private nextCharacterX = 258;

    constructor() {
        super();
        console.log(this.acceptableWord);
    }

    writeLetter(letterID: number) {
        const s_character = new Sprite("letter-"+(letterID+1));
        s_character.anchor.set(0, 0);
        s_character.scale.set(0.8);

        if (this.nextCharacterX+s_character.width-2 <= 432) {
            s_character.position.set(this.nextCharacterX, 155);
            s_character.tint = "#0021df";
            s.misc.addChild(s_character);

            this.nextCharacterX += s_character.width-2;
            this.writtenWord += g.RUSSIAN_LETTERS[letterID];

            soundManager.produce("68:write");
        }
    }

    eraseLetters() {
        this.writtenWord = "";
        this.nextCharacterX = 258;
        s.misc.destroyChildren();
    }

    check() {
        if (this.writtenWord === this.acceptableWord) {
            s.main.nextQuestion();
        }
        else {
            
            s.main.loseLife();
            if (g.lives !== 0) {
                this.eraseLetters();
            }
        }
    }
}
class S68_KeyButtons extends TopContainer {
    private s_letter;
    private s_key = new Sprite();
    private clickHitbox = new CompHitbox(this, {offsetX: -19, offsetY: -19, width: 38, height: 38});
    
    // multitouch support
    constructor(public readonly letterID: number, x: number, y: number) {
        super();
        this.s_letter = new Sprite(`letter-`+(letterID+1));
        this.s_letter.scale.set(2/3);
        this.s_letter.tint = "#e0f0ff";

        this.position.set(x, y);

        this.addChild(this.s_key, this.s_letter);

        this.s_key.changeTextureKey("68:keyboard_button");
    }

    private pressed = false;

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
            
                if (m.fingerIsDown(0)) {
                    this.pressed = this.clickHitbox.collideFinger(0);
                }
                else {
                    if (this.pressed) {
                        this.clickAction();
                        this.pressed = false;
                    }
                }

                this.s_key.changeTextureKeyTick(this.pressed ? "68:keyboard_button-p" : "68:keyboard_button");
                break;
        }
    }

    private clickAction() {
        s.q68_controller.children[0].writeLetter(this.letterID);
    }
}


// QUESTION 70
class S70_Button extends SButtonConfigurable {
    constructor() {
        super({
            idle: "70:button-1",
            x: 240, y: 220,
            clickHitboxProps: gatheredAssets.masks["70:button-1"],
            clickProcessMessage: Msg.TICK_GAME_CLICK,
            clickAction: ()=>{
                s.main.gameOver();
            }
        });
    }

    allowToClick() {
        this.textureKeys.idle = "70:button-2";
        this.clickAction = ()=>{
            s.main.nextQuestion();
        }
    }
}

class S70_QuestionText extends TopSprite {
    allowedToClick = false;

    constructor() {
        super("70:text-1");
        this.anchor.set(0, 0);
        this.position.set(0, 0);
    }

    allowToClick() {
        this.changeTextureKey("70:text-2");
        s.q70_button.children[0].allowToClick();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                if (s.bomb.children[0].timeLeftIH === 1 && !this.allowedToClick) {
                    this.allowToClick();
                    this.allowedToClick = true;
                }
                break;
        }
    }
}


class SGameCompletePoster extends TopSprite {
    animAppear = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.alpha = t.percent;
            }
        })
    
    constructor() {
        super("menus:game_complete_poster");
        this.anchor.set(0, 0);

        soundManager.produce("game_complete");
        this.animAppear.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                this.animAppear.simulateTick();
                break;
        }
    }
}


//! SPRITE STORAGE

class SpriteStorage {
    // (EDITABLE)
    //#region 
    main = new Main();
    background = new GBackground();

    // menus
    title = new TopCollection<STitle>();

    caution_poster = new TopCollection<SCautionPoster>();
    button_continue = new TopCollection<SButtonContinue>();

    instruction_poster1 = new TopCollection<SInstructionsPoster1>();
    instruction_poster2 = new TopCollection<SInstructionsPoster2>();
    button_back = new TopCollection<SButtonBack>();

    button_play = new TopCollection<SButtonPlay>();
    button_how_to_play = new TopCollection<SButtonHowToPlay>();
    button_play_part_link = new TopCollection<SButtonPlayPartLink>();


    // game
    game_background_decoration = new TopCollection<SGameBackgroundDecoration>();
    button_choice = new TopCollection<SButtonChoice>();
    button_next = new TopCollection<SButtonNext>();
    misc = new TopCollection();

    question_text = new TopCollection<SQuestionText>();
    question_number = new TopCollection<SQuestionNumber>();
    lives_text = new TopCollection<SLivesText>();
    lives_number = new TopCollection<SLivesNumber>();
    bomb = new TopCollection<SBomb>();
    
    // game over
    effect_explosion = new SEffectExplosion();
    effect_smudge = new SEffectSmudge();

    game_over_poster = new SGameOverPoster();
    button_play_again = new SButtonPlayAgain();

    effect_paint = new SEffectPaint();
    effect_plain_cover = new SEffectPlainCover();

    // question 36
    q36_controller = new TopCollection<S36_Controller>();
    q36_elements = new TopCollection<S36_Elements>();
    q36_lines = new TopCollection<S36_Lines>();

    // question 40
    q40_controller = new TopCollection<S40_Controller>();

    q40_background_cover = new TopCollection<S40_BackgroundCover>();
    q40_screen = new TopCollection<S40_Screen>();
    q40_screen_flash = new TopCollection<S40_ScreenFlash>();
    q40_red_frame = new TopCollection<S40_RedFrame>();

    q40_string = new TopCollection<S40_String>();
    q40_buttons = new TopCollection<S40_Buttons>();
    q40_tip = new TopCollection<S40_FadeTip>();

    q44_begin_text = new TopCollection<S44_BeginText>();
    q44_begin_point = new TopCollection<S44_BeginPoint>();
    q44_maze = new TopCollection<S44_Maze>();
    q44_maze_text = new TopCollection<S44_MazeText>();
    
    q45_controller = new TopCollection<S45_Controller>();
    q45_chests = new TopCollection<S45_Chests>();
    q45_text = new TopCollection<S45_Text>();

    q49_draggable_items = new TopCollection<S49_DraggableItems>();
    q49_schoolbag = new TopCollection<S49_Schoolbag>();

    q50_arrow_level = new TopCollection<S50_ArrowLevel>();

    q51_bean = new TopCollection<S51_BeanAndController>();

    q53_controller = new TopCollection<S53_Controller>();
    q53_draggable_items = new TopCollection<S53_DraggableItems>();

    q55_background = new TopCollection<S55_Background>();
    q55_question_text = new TopCollection<S55_QuestionText>();

    q56_controller = new TopCollection<S56_Controller>();
    q56_question_text = new TopCollection<S56_QuestionText>();
    q56_background = new TopCollection<S56_Background>();

    q60_pump = new TopCollection<S60_Pump>();
    q60_volleyball = new TopCollection<S60_Volleyball>();

    q68_background = new TopCollection<S68_Background>();
    q68_controller = new TopCollection<S68_Controller>();
    q68_key_buttons = new TopCollection<S68_KeyButtons>();

    q63_controller = new TopCollection<S63_Controller>();
    q63_matches = new TopCollection<S63_Matches>();
    
    q70_question_text = new TopCollection<S70_QuestionText>();
    q70_button = new TopCollection<S70_Button>();

    game_complete_poster = new TopCollection<SGameCompletePoster>();

    //#endregion
    objectList(): TopObjectOrCollection[] {

        // add objects to the logic and drawing order (EDITABLE)
        return [
            this.main, this.background,
            this.q55_background, this.q56_background, this.q68_background,

            this.game_background_decoration,

            this.title,

            this.caution_poster, this.button_continue,
            this.instruction_poster2, this.instruction_poster1, this.button_back,

            this.button_play, this.button_how_to_play, this.button_play_part_link,

            this.button_choice, this.question_text, this.q55_question_text, this.q56_question_text,

            this.misc,

            this.q36_controller,
            this.q36_lines, this.q36_elements,

            this.q40_controller, 
            this.q40_screen, this.q40_screen_flash, this.q40_string,
            this.q40_background_cover, this.q40_red_frame, this.q40_buttons, this.q40_tip,

            this.q44_maze, this.q44_maze_text, this.q44_begin_text, this.q44_begin_point,

            this.q45_controller, this.q45_text, this.q45_chests,

            this.q49_schoolbag, this.q49_draggable_items,

            this.q50_arrow_level,

            this.q51_bean,

            this.q53_controller, this.q53_draggable_items,

            this.q56_controller,

            this.q60_pump, this.q60_volleyball,
            
            this.q63_controller, this.q63_matches,

            this.q68_controller, this.q68_key_buttons,

            this.q70_question_text, this.q70_button,
            
            this.question_number, this.bomb, this.effect_explosion,
            this.lives_text, this.lives_number, this.button_next,

            this.effect_plain_cover,
            this.effect_smudge, this.game_over_poster, this.button_play_again, this.effect_paint,

            this.game_complete_poster
        ];
    }

    //#region
    /** The basic container of all objects */
    container: PIXI.Container<TopObjectOrCollection | PIXI.RenderLayer> = new PIXI.Container();

    constructor() {
        this.container.interactiveChildren = false;
        this.container.accessibleChildren = false;
        this.container.cullableChildren = false;

        for (let topObject of this.objectList()) {
            this.container.addChild(topObject);
        }
        // add layers for rendering objects
        for (let layer of layers) {
            this.container.addChild(layer);
        }
    }

    // sprite service functions    

    updateObjects() {
        // messageStep
        m.messages.broadcast(Msg.TICK);

        while (m.messages.isNotEmpty()) {
            let message = m.messages.obtain()!;

            for (const topElement of this.container.children) {
                if (topElement instanceof TopCollection) {
                    for (const bottomObject of topElement.children) {
                        if (bottomObject.enabled && !bottomObject.new) {
                            bottomObject.messageStep(message);
                        }
                    }
                }
                else if (!(topElement instanceof PIXI.RenderLayer)) {
                    if (topElement.enabled && !topElement.new) {
                        topElement.messageStep(message);
                    }
                }
            }
        }

        // this.container.children.filter(o=>(o.master && o.master.destroyed)).forEach(o=>{o.destroy();})


        this.takeNewFromObjects();
    }

    takeNewFromObjects(){
        for (const topElement of this.container.children) {
            if (topElement instanceof TopCollection) {
                for (const bottomObject of topElement.children) {
                    if (bottomObject.new) {
                        bottomObject.new = false;
                    }
                }
            }
            else if (!(topElement instanceof PIXI.RenderLayer)) {
                if (topElement.new) {
                    topElement.new = false;
                }
            }
        }
    }
    //#endregion
}

type TopObjectType = TopSprite|TopContainer;
type TopObjectOrCollection = TopObjectType|TopCollection<TopObjectType>;

/** When constructing an object while the project is loading, the sprite storage is not yet accessible.
 * 
 * Example 1: pass another object as a constructor parameter
 * ```
 * constructor(another_object: SAnotherObject) {
 *      console.log(another_object);
 * }
 * ```
 * Example 2: obtain another object from the storage when the message `Msg.START` is broadcast
 * ```
 * messageStep(message: Msg) {
 *      switch (message) {
 *          case Msg.START:
 *              console.log(s.another_object);
 *              break;
 *      }
 * }
 * ```
 */
let s: SpriteStorage;



//! DOCUMENT INTERACTION
//#region 

const els = {
    divProgressBar: <HTMLDivElement>document.getElementById("divProgressBar"),
    bFullscreen: <HTMLButtonElement>document.getElementById("bFullscreen"),
    bFullscreenImgSwitch: <NodeListOf<HTMLImageElement>> document.querySelectorAll(".bFullscreenImgSwitch"),

    divDialog1: <HTMLDivElement>document.getElementById("divDialog1"),

    divGame: <HTMLDivElement>document.getElementById("divGame"),
    divCanvasPositioning: <HTMLDivElement>document.getElementById("divCanvasPositioning"),
    divCanvas: <HTMLDivElement>document.getElementById("divCanvas"),
    divCanvasElements: <HTMLDivElement>document.getElementById("divCanvasElements")
}
function showEl(el: HTMLElement) {
    el.classList.remove("hide");
}
function hideEl(el: HTMLElement) {
    el.classList.add("hide");
}
class FullscreenPolyfill {
    static waitingForFullscreen = false;
    static isFullscreen = false;
    static fullscreenIsSupported: boolean;
    static prefix: string;
    static event="";

    static {
        if (document.fullscreenEnabled!==undefined) {
            this.fullscreenIsSupported = document.fullscreenEnabled;
            this.prefix = "";
            this.event = "fullscreenchange";
        }
        else if (((<any>document).webkitFullscreenEnabled)!==undefined) {
            this.fullscreenIsSupported = ((<any>document).webkitFullscreenEnabled);
            this.prefix = "webkit";
            this.event = "webkitfullscreenchange";
        }
        else if (((<any>document).mozFullScreenEnabled)!==undefined) {
            this.fullscreenIsSupported = ((<any>document).mozFullScreenEnabled);
            this.prefix = "moz";
            this.event = "mozfullscreenchange";
        }
        else {
            this.fullscreenIsSupported = false;
            this.prefix = "";
        }

        if (this.fullscreenIsSupported) {
            els.bFullscreen.classList.remove("hide");
        }
    }
    
    static requestFullscreen(el: Element) {
        if (this.prefix==="") {
            el.requestFullscreen();
        }
        else if (this.prefix==="webkit") {
            (<any>el).webkitRequestFullscreen();
        }
        else if (this.prefix==="moz") {
            (<any>el).mozRequestFullScreen();
        }
    }
    
    static exitFullscreen() {
        if (this.prefix==="") {
            document.exitFullscreen();
        }
        else if (this.prefix==="webkit") {
            (<any>document).webkitExitFullscreen();
        }
        else if (this.prefix==="moz") {
            (<any>document).mozCancelFullScreen();
        }
    }
}
class PageVisibilityPolyfill {
    static prefix="";
    static event="";

    static get hidden(): boolean {
        return (
            (this.prefix==="webkit") ? (<any>document).webkitHidden
            : (this.prefix==="moz") ? (<any>document).mozHidden
            : document.hidden
        );
    }

    static {
        if (document.hidden!==undefined) {
            this.prefix = "";
            this.event = "visibilitychange";
        }
        else if (((<any>document).webkitHidden)!==undefined) {
            this.prefix = "webkit";
            this.event = "webkitvisibilitychange";
        }
        else if (((<any>document).mozHidden)!==undefined) {
            this.prefix = "moz";
            this.event = "mozvisibilitychange";
        }
    }
}
class Service {
    static updateBFullscreenImg() {
        els.bFullscreenImgSwitch.forEach((el)=>{hideEl(el);})
        if (FullscreenPolyfill.isFullscreen) {
            // fullscreen exit
            showEl(els.bFullscreenImgSwitch[1]);
        }
        else {
            if (FullscreenPolyfill.waitingForFullscreen) {
                // close dialog1
                showEl(els.bFullscreenImgSwitch[2]);
            }
            else {
                // fullscreen enter
                showEl(els.bFullscreenImgSwitch[0]);
            }
        }
    }

    static showDialog1() {
        FullscreenPolyfill.waitingForFullscreen = true;
        showEl(els.divDialog1);
    }
    static hideDialog1() {
        FullscreenPolyfill.waitingForFullscreen = false;
        hideEl(els.divDialog1);
    }

    
}
class MaskCreator {
    private canvas: HTMLCanvasElement;
    private ctxM: CanvasRenderingContext2D;
    constructor(maxWidth=480, maxHeight=360) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = maxWidth;
        this.canvas.height = maxHeight;
        this.ctxM = this.canvas.getContext("2d", {willReadFrequently: true})!;
    }

    createMask(image: HTMLImageElement, alphaThreshold=0.5){
        // Transformation such as scale and rotation not provided

        this.ctxM.drawImage(image, 0, 0);

        // mask matrix the size of a target image
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const pixels = this.ctxM.getImageData(0, 0, width, height);

        let matrix = new Uint8Array( Math.ceil(width*height/8) );
        
        let B = 0; // byte
        let b = 0; // bit
        let currentByte = 0;
        for (let i = 3; i < pixels.data.length; i+=4) {
            currentByte = currentByte<<1;
            if (pixels.data[i] > Math.round(alphaThreshold*(255-1))) { // if the pixel is not transparent
                currentByte += 1;
            }

            // increment the bit
            b++;
            if (b>=8) {
                matrix[B] = currentByte;
                currentByte = 0;
                b = 0;
                B++;
            }
        }
        

        this.ctxM.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return {offsetX: 0, offsetY: 0, width: width, height: height, matrix: matrix};
    }

    static createMaskFromPixels(data: PIXI.GetPixelsOutput, alphaThreshold=0.5): MaskProps {
        // Transformation such as scale and rotation not provided

        let matrix = new Uint8Array( Math.ceil(data.width*data.height/8) );

        // mask matrix the size of a target image
        let B = 0; // byte
        let b = 0; // bit
        let currentByte = 0;
        for (let i = 3; i < data.pixels.length; i+=4) {
            currentByte = currentByte<<1;
            if (data.pixels[i] > Math.round(alphaThreshold*(255-1))) { // if the pixel is not transparent
                currentByte += 1;
            }

            // increment the bit
            b++;
            if (b>=8) {
                matrix[B] = currentByte;
                currentByte = 0;
                b = 0;
                B++;
            }
        }
        
        return {offsetX: 0, offsetY: 0, width: data.width, height: data.height, matrix: matrix};
    }
}



const divCanvasPos = {x: 0, y: 0}; // need for correct mouse/pointer position
//! SCREEN
class Screen {
    private app;

    private realScale = 0;
    private integerResolution = 0;
    private offscreenRenderer;
    private screenSprite;

    constructor(public readonly LOGICAL_WIDTH: number, public readonly LOGICAL_HEIGHT: number) {
        this.app = new PIXI.Application();

        this.offscreenRenderer = PIXI.RenderTexture.create({
            width: this.LOGICAL_WIDTH,
            height: this.LOGICAL_HEIGHT,
            dynamic: true, // so that it can visually resize
            antialias: true, /* user setting */
            resolution: dp, // set the offscreen resolution here too
        });

        // screen display sprite
        this.screenSprite = new PIXI.Sprite(this.offscreenRenderer);
        this.screenSprite.position.set(0, 0);
    }
 
    public async init(resourcesToLoad: ResourcesToLoad) {
        // set up the application
        await this.app.init({
            resizeTo: els.divCanvas,
            antialias: true, /* user setting */
            resolution: dp,
            backgroundColor: "#f0f0f0"
        });
        this.app.canvas.id = "canvas";

        // load assets and wait
        await loadAssets(resourcesToLoad);
        
        // change scaling mode of some images to nearest
        if (resourcesToLoad.nearestFilterImages) {
            for (let key of resourcesToLoad.nearestFilterImages) {
                gatheredAssets.textures[key].source.scaleMode = "nearest";
            }
        }

        // initially make textures from HTML images through Canvas API
        for (let key in gatheredAssets.htmlImages) {
            const c = document.createElement("canvas");
            const ctx = c.getContext("2d")!;
            gatheredAssets.canvases[key] = {
                c: c,
                ctx: ctx
            };

            c.width = gatheredAssets.htmlImages[key].naturalWidth;
            c.height = gatheredAssets.htmlImages[key].naturalHeight;

            ctx.scale(1, 1);
            ctx.drawImage(gatheredAssets.htmlImages[key], 0, 0);

            const canvasSource = new PIXI.CanvasSource({
                resource: c
            });
            gatheredAssets.textures[key] = new PIXI.Texture(canvasSource);
        }

        // obtain masks
        if (resourcesToLoad.masks) {
            const maskCreator = new MaskCreator(screen.LOGICAL_WIDTH, screen.LOGICAL_HEIGHT);

            for (let maskSource of resourcesToLoad.masks) {
                if (gatheredAssets.htmlImages[maskSource]) {
                    gatheredAssets.masks[maskSource] = maskCreator.createMask(gatheredAssets.htmlImages[maskSource]);
                }
                else if (gatheredAssets.textures[maskSource]) {
                    const texture = gatheredAssets.textures[maskSource];
                    const data = this.app.renderer.extract.pixels(texture); // obtain pixels
                    gatheredAssets.masks[maskSource] = MaskCreator.createMaskFromPixels(data);
                }
                else {
                    console.warn(`The texture key is not found to create the mask from: ${maskSource}`)
                }
            }
        }
        
        // obtain volume nodes
        if (resourcesToLoad.audioVolumeNodes) {
            soundManager.volumeNodes.set("general", soundManager.audioCtx.createGain());
            for (let volumeNode of resourcesToLoad.audioVolumeNodes) {
                soundManager.volumeNodes.set(volumeNode, soundManager.audioCtx.createGain());
            }
        }

        // create the sprite storage
        s = new SpriteStorage();
        s.takeNewFromObjects();

        // add the screen sprite
        this.app.stage.addChild(this.screenSprite);
        
        // add ticker
        this.app.ticker.add((time)=>{

            try {
                if (true) {
                    // STEP 1: measure time
                    m.delta = time.deltaMS/1000;
                    if (m.delta > 0.5) {m.delta = 0;}
                    m.time += m.delta;
                    
                    // STEP 2: handle the logic of objects
                    s.updateObjects();

                    // STEP 3: draw
                    this.renderOffscreen();

                    // STEP 4: pass user input
                    for (let value of m.keyboardCodes.values()) {
                        if (!value.holding) {
                            value.holding = true;
                        }
                    }
                    for (let value of m.touches.values()) {
                        if (!value.holding) {
                            value.holding = true;
                        }
                    }

                    if (m.resolutionHasChanged) {m.resolutionHasChanged = false;}
                }
            }
            catch(e){console.error(e);alert(e);this.app.ticker.stop();}
        });
        this.setEventListeners();

        // set width and height of #divCanvasElements
        els.divCanvasElements.style.width = `${this.LOGICAL_WIDTH}px`;
        els.divCanvasElements.style.height =`${this.LOGICAL_HEIGHT}px`;

        // Show game
        els.divCanvas.prepend(this.app.canvas);
        hideEl(els.divProgressBar);
        showEl(els.divGame);
        
        // important on load
        this.onResize();
        m.messages.broadcast(Msg.START);
    }


    private updateTouches(event: TouchEvent) {
        for (let touch of event.changedTouches) {
            const touchProperty = m.touches.get(touch.identifier);
            const touchP = {
                x: clamp(Math.round((touch.clientX-divCanvasPos.x) / this.realScale), 0, this.LOGICAL_WIDTH),
                y: clamp(Math.round((touch.clientY-divCanvasPos.y) / this.realScale), 0, this.LOGICAL_HEIGHT)
            };
            if (!touchProperty) {
                // create
                m.touches.set(touch.identifier, {
                    position: touchP, 
                    holding: false
                });
            }
            else {
                // update
                touchProperty.position.x = touchP.x;
                touchProperty.position.y = touchP.y;
            }

            if (touch.identifier === 0) {
                m.mouseX = touchP.x;
                m.mouseY = touchP.y;
            }
        }
    }
    private removeTouches(event: TouchEvent) {
        for (let touch of event.changedTouches) {
            m.touches.delete(touch.identifier);
        }
    }


    private setEventListeners() {
        // There are 10+(3*inputs.length) event listeners

        // resize
        window.addEventListener("resize", ()=>{
            if (!m.isFocused) {
                this.onResize();
            }
            else {
                if (window.innerHeight*dp < parseInt(els.divCanvas.style.height)) { // if the viewport height is less than canvas height (in device pixels)
                    els.divCanvasPositioning.classList.add("js-input-scrollable");
                } else {
                    els.divCanvasPositioning.classList.remove("js-input-scrollable");
                }
            }
        });

        // mouse-touch interaction
        // mutli-touch (OPTIONAL)
        if (!m.isTouchDevice) {
            // mouse
            els.divCanvas.addEventListener("mouseout", (event)=>{
                m.touches.delete(0);
            });
            els.divCanvas.addEventListener("mousemove", (event)=>{
                m.mouseX = Math.round((event.clientX-divCanvasPos.x) / this.realScale);
                m.mouseY = Math.round((event.clientY-divCanvasPos.y) / this.realScale);
                
                const touchProperty = m.touches.get(0);
                if (touchProperty) {
                    touchProperty.position.x = m.mouseX;
                    touchProperty.position.y = m.mouseY;
                }
            });
            els.divCanvas.addEventListener("mousedown", (event)=>{
                if (event.button===0) {
                    m.touches.set(0, {position: {x: m.mouseX, y: m.mouseY}, holding: false});
                }
            });
            els.divCanvas.addEventListener("mouseup", (event)=>{
                if (event.button===0) {
                    m.touches.delete(0);
                }
            });
        }
        else {
            // touch
            els.divCanvas.addEventListener("touchstart", (event)=>{event.preventDefault(); this.updateTouches(event);}, {passive: false});
            els.divCanvas.addEventListener("touchmove", (event)=>{event.preventDefault(); this.updateTouches(event);}, {passive: false});
            els.divCanvas.addEventListener("touchend", (event)=>{this.removeTouches(event);});
            els.divCanvas.addEventListener("touchcancel", (event)=>{this.removeTouches(event);});
        }


        // keyboard (OPTIONAL)
        if (!m.isTouchDevice) {
            document.addEventListener("keydown", (event)=>{
                m.simulateKeyDown(event.code, event.key);
            });
            document.addEventListener("keyup", (event)=>{
                m.simulateKeyUp(event.code);
            });
        }

        

        // input fields
        {
            const inputs = document.querySelectorAll("#divCanvasElements input, #divCanvasElements textarea");
            for (let inputField of inputs) {
                inputField.addEventListener("change", function(event){
                    (<HTMLElement>event.target).blur();
                });
                inputField.addEventListener("blur", function(event){
                    m.isFocused = false;
                    els.divCanvasPositioning.classList.remove("js-input-scrollable");
                });
                inputField.addEventListener("focus", function(event){
                    m.isFocused = true;
                });
            }
        }


        // event listeners for orientation detection and fullscreen toggle
        if (FullscreenPolyfill.fullscreenIsSupported) {
            // when the button clicked
            els.bFullscreen.addEventListener("click", function(){
                if (FullscreenPolyfill.waitingForFullscreen) {
                    Service.hideDialog1();
                    Service.updateBFullscreenImg();
                }
                else {
                    if (!FullscreenPolyfill.isFullscreen) {
                        if (!m.isFocused) {
                            if (!m.isMobile || window.matchMedia("(orientation: landscape)").matches) {
                                FullscreenPolyfill.requestFullscreen(document.documentElement);
                            }
                            else {
                                Service.showDialog1();
                                Service.updateBFullscreenImg();
                            }
                        }
                    }
                    else {
                        FullscreenPolyfill.exitFullscreen();
                    }
                }
            });

            // when the screen orientation is changed
            window.matchMedia("(orientation: landscape)").addEventListener("change", function(event){
                if (FullscreenPolyfill.waitingForFullscreen && event.matches) {
                    FullscreenPolyfill.requestFullscreen(document.documentElement);
                    Service.hideDialog1();
                }
            });

            // when the fullscreen mode is toggled
            document.addEventListener(FullscreenPolyfill.event, function(){
                FullscreenPolyfill.isFullscreen = Boolean(document.fullscreenElement);
                Service.updateBFullscreenImg();
            });
        }


        // disable pull-to-refresh for mobile devices
        document.documentElement.style.overscrollBehavior = "none";

        // disable right-click context menu
        els.divCanvas.addEventListener("contextmenu", (event)=>{
            const target = <HTMLElement|null>event.target;
            if (target && (target.id === "canvas" || target.id === "divCanvasElements" || target.classList.contains("transparent"))) {
                event.preventDefault(); // stop context menu
            }
        });

        // check document on activity
        if (PageVisibilityPolyfill.event) {
            document.addEventListener(PageVisibilityPolyfill.event, ()=>{
                if (PageVisibilityPolyfill.hidden) {
                    soundManager.pauseCtx();
                }
                else {
                    soundManager.resumeCtx();
                }
            });
        }
    }


    private renderOffscreen() {
        // render the original container to the intermediate this.offscreenRenderer
        this.app.renderer.render({
            container: s.container,
            target: this.offscreenRenderer,
            clear: true
        });
    }


    private onResize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // calculate realScale
        const newRealScale = Math.min(screenWidth / this.LOGICAL_WIDTH, screenHeight / this.LOGICAL_HEIGHT);
        if (this.realScale !== newRealScale && newRealScale > 0.05) {
            this.realScale = newRealScale;
            this.updateScaleContainer(
                this.LOGICAL_WIDTH * this.realScale,
                this.LOGICAL_HEIGHT * this.realScale
            );

            // scale elements
            els.divCanvasElements.style.transform = `scale(${this.realScale})`;

            if (this.integerResolution !== Math.ceil(this.realScale*dp)) {
                this.integerResolution = Math.ceil(this.realScale*dp);
                this.updateTextureResolution();
            }
        }
        // calculate position of divCanvas
        {
            const divCanvasClientRect = els.divCanvas.getBoundingClientRect();
            divCanvasPos.x = divCanvasClientRect.x;
            divCanvasPos.y = divCanvasClientRect.y;
        }
    }


    private updateScaleContainer(targetWidth: number, targetHeight: number) {
        // resize divCanvas and canvas to fit
        els.divCanvas.style.width = Math.floor(targetWidth)+"px";
        els.divCanvas.style.height = Math.floor(targetHeight)+"px";
        this.app.canvas.style.width = Math.floor(targetWidth)+"px";
        this.app.canvas.style.height = Math.floor(targetHeight)+"px";

        // resize the screen
        this.app.queueResize();

        // scale the container
        s.container.scale = this.realScale;
        this.offscreenRenderer.resize(Math.floor(targetWidth), Math.floor(targetHeight));
    }


    private updateTextureResolution() {
        m.resolutionHasChanged = true;

        // resize the canvas to a new resolution
        for (let key in gatheredAssets.htmlImages) {
            const img = gatheredAssets.htmlImages[key];
            const {c, ctx} = gatheredAssets.canvases[key];
            c.width = img.naturalWidth*this.integerResolution;
            c.height = img.naturalHeight*this.integerResolution;

            ctx.scale(this.integerResolution, this.integerResolution);
            ctx.drawImage(img, 0, 0);

            // apply texture change
            gatheredAssets.textures[key].source.resolution = this.integerResolution;
            gatheredAssets.textures[key].source.update();
        }

        // change the resolution to texts
        for (let text of holder.texts) {
            text.resolution = this.integerResolution;
        }
    }


    public updateTextResolution(text: SmoothText) {
        text.resolution = this.integerResolution;
    }


    public graphicsToTexture(graphics: PIXI.Graphics) {
        return this.app.renderer.generateTexture({
            target: graphics,
            resolution: this.integerResolution
        });
    }
}

//#endregion
let screen = new Screen(480, 360);


//! ASYNC INIT WITH RESOURCES (EDITABLE)
screen.init({
    images: {
        "36:1a": "assets/36/boy.png",
        "36:1b": "assets/36/index_pointing_up.png",
        "36:2a": "assets/36/red_envelope.png",
        "36:2b": "assets/36/airplane.png",
        "36:3a": "assets/36/three.png",
        "36:3b": "assets/36/pig_face.png",
        "36:4a": "assets/36/coin.png",
        "36:4b": "assets/36/tropical_fish.png",

        "40:screen": "assets/40/screen.png",
        "40:red_flash": "assets/40/red_flash.png",
        "40:orange_flash": "assets/40/orange_flash.png",
        "40:yellow_flash": "assets/40/yellow_flash.png",
        "40:green_flash": "assets/40/green_flash.png",
        "40:light_blue_flash": "assets/40/light_blue_flash.png",
        "40:blue_flash": "assets/40/blue_flash.png",
        "40:purple_flash": "assets/40/purple_flash.png",
        "40:white_flash": "assets/40/white_flash.png",

        "44:maze_collision": "assets/44/maze_collision.png",
        "44:maze_spinner_collision": "assets/44/maze_spinner_collision.png",

        "effect-paint": "assets/game/effect-paint.png",
    },
    svg: {
        "menus:caution": "assets/menus/caution.svg",
        "menus:instructions-1": "assets/menus/instructions-1.svg",
        "menus:instructions-2": "assets/menus/instructions-2.svg",
        "menus:instructions-2-light": "assets/menus/instructions-2-light.svg",
        "menus:game_over": "assets/menus/game_over.svg",
        "menus:game_over-light": "assets/menus/game_over-light.svg",

        "title-1": "assets/menus/title-1.svg",
        "title-2": "assets/menus/title-2.svg",
        "title-3": "assets/menus/title-3.svg",

        "menus:button-continue": "assets/menus/button-continue.svg",
        "menus:button-continue-p": "assets/menus/button-continue-p.svg",
        "menus:button-play": "assets/menus/button-play.svg",
        "menus:button-play-p": "assets/menus/button-play-p.svg",
        "menus:button-back": "assets/menus/button-back.svg",
        "menus:button-back-p": "assets/menus/button-back-p.svg",
        "menus:button-how_to_play": "assets/menus/button-how_to_play.svg",
        "menus:button-how_to_play-p": "assets/menus/button-how_to_play-p.svg",
        "menus:button-play_part": "assets/menus/button-play_part.svg",
        "menus:button-play_part-p": "assets/menus/button-play_part-p.svg",
        
        "menus:button-play_again": "assets/menus/button-play_again.svg",
        "menus:button-play_again-p": "assets/menus/button-play_again-p.svg",

        "background_decoration-f1": "assets/game/background_decoration-f1.svg",
        "background_decoration-f2": "assets/game/background_decoration-f2.svg",

        "button-choice": "assets/game/button-choice.svg",
        "button-choice-p": "assets/game/button-choice-p.svg",

        "lives-text": "assets/game/lives-text.svg",
        "lives-1": "assets/game/lives-1.svg",
        "lives-2": "assets/game/lives-2.svg",
        "lives-3": "assets/game/lives-3.svg",
        "lives-4": "assets/game/lives-4.svg",
        "lives-5": "assets/game/lives-5.svg",

        "bomb-f1": "assets/game/bomb-f1.svg",
        "bomb-f2": "assets/game/bomb-f2.svg",
        "bomb-f3": "assets/game/bomb-f3.svg",
        "bomb-f4": "assets/game/bomb-f4.svg",
        "time_bomb-0": "assets/game/time_bomb-0.svg",
        "time_bomb-1": "assets/game/time_bomb-1.svg",
        "time_bomb-2": "assets/game/time_bomb-2.svg",
        "time_bomb-3": "assets/game/time_bomb-3.svg",
        "time_bomb-4": "assets/game/time_bomb-4.svg",
        "time_bomb-5": "assets/game/time_bomb-5.svg",
        "time_bomb-6": "assets/game/time_bomb-6.svg",
        "time_bomb-7": "assets/game/time_bomb-7.svg",
        "time_bomb-8": "assets/game/time_bomb-8.svg",
        "time_bomb-9": "assets/game/time_bomb-9.svg",
        "time_bomb-10": "assets/game/time_bomb-10.svg",
        "time_bomb-11": "assets/game/time_bomb-11.svg",
        "time_bomb-12": "assets/game/time_bomb-12.svg",
        "time_bomb-13": "assets/game/time_bomb-13.svg",
        "time_bomb-14": "assets/game/time_bomb-14.svg",
        "time_bomb-15": "assets/game/time_bomb-15.svg",

        "question-31": "assets/questions/31.svg",
        "question-32": "assets/questions/32.svg",
        "question-33": "assets/questions/33.svg",
        "question-34": "assets/questions/34.svg",
        "question-35": "assets/questions/35.svg",
        "question-36": "assets/questions/36.svg",
        "question-37": "assets/questions/37.svg",
        "question-38": "assets/questions/38.svg",
        "question-39": "assets/questions/39.svg",
        "question-41": "assets/questions/41.svg",
        "question-42": "assets/questions/42.svg",
        "question-43": "assets/questions/43.svg",
        "question-45": "assets/questions/45.svg",
        "question-46": "assets/questions/46.svg",
        "question-47": "assets/questions/47.svg",
        "question-48": "assets/questions/48.svg",
        "question-49": "assets/questions/49.svg",
        "question-51": "assets/questions/51.svg",
        "question-52": "assets/questions/52.svg",
        "question-53": "assets/questions/53.svg",
        "question-54": "assets/questions/54.svg",
        "question-55-q": "assets/questions/55-q.svg",
        "question-56": "assets/questions/56.svg",
        "question-56-q": "assets/questions/56-q.svg",
        "question-57": "assets/questions/57.svg",
        "question-58": "assets/questions/58.svg",
        "question-59": "assets/questions/59.svg",
        "question-61": "assets/questions/61.svg",
        "question-62": "assets/questions/62.svg",
        "question-62-a": "assets/questions/62-a.svg",
        "question-63": "assets/questions/63.svg",
        "question-64": "assets/questions/64.svg",
        "question-66": "assets/questions/66.svg",
        "question-67": "assets/questions/67.svg",
        "question-69": "assets/questions/69.svg",

        "question_number-circle": "assets/question_numbers/circle.svg",
        "question_number-31": "assets/question_numbers/31.svg",
        "question_number-32": "assets/question_numbers/32.svg",
        "question_number-33": "assets/question_numbers/33.svg",
        "question_number-34": "assets/question_numbers/34.svg",
        "question_number-35": "assets/question_numbers/35.svg",
        "question_number-36": "assets/question_numbers/36.svg",
        "question_number-37": "assets/question_numbers/37.svg",
        "question_number-38": "assets/question_numbers/38.svg",
        "question_number-39": "assets/question_numbers/39.svg",
        "question_number-40": "assets/question_numbers/40.svg",
        "question_number-41": "assets/question_numbers/41.svg",
        "question_number-42": "assets/question_numbers/42.svg",
        "question_number-43": "assets/question_numbers/43.svg",
        "question_number-44": "assets/question_numbers/44.svg",
        "question_number-45": "assets/question_numbers/45.svg",
        "question_number-46": "assets/question_numbers/46.svg",
        "question_number-47": "assets/question_numbers/47.svg",
        "question_number-48": "assets/question_numbers/48.svg",
        "question_number-49": "assets/question_numbers/49.svg",
        "question_number-50": "assets/question_numbers/50.svg",
        "question_number-51": "assets/question_numbers/51.svg",
        "question_number-52": "assets/question_numbers/52.svg",
        "question_number-53": "assets/question_numbers/53.svg",
        "question_number-54": "assets/question_numbers/54.svg",
        "question_number-55": "assets/question_numbers/55.svg",
        "question_number-56": "assets/question_numbers/56.svg",
        "question_number-57": "assets/question_numbers/57.svg",
        "question_number-58": "assets/question_numbers/58.svg",
        "question_number-59": "assets/question_numbers/59.svg",
        "question_number-60": "assets/question_numbers/60.svg",
        "question_number-61": "assets/question_numbers/61.svg",
        "question_number-62": "assets/question_numbers/62.svg",
        "question_number-63": "assets/question_numbers/63.svg",
        "question_number-64": "assets/question_numbers/64.svg",
        "question_number-65": "assets/question_numbers/65.svg",
        "question_number-66": "assets/question_numbers/66.svg",
        "question_number-67-circle": "assets/question_numbers/67-circle.svg",
        "question_number-68": "assets/question_numbers/68.svg",
        "question_number-69": "assets/question_numbers/69.svg",
        "question_number-70": "assets/question_numbers/70.svg",

        "button-next": "assets/game/button-next.svg",
        "button-next-p": "assets/game/button-next-p.svg",

        "36:element-base": "assets/36/element-base.svg",
        "36:element-outline": "assets/36/element-outline.svg",

        "37:drum": "assets/37/drum.svg",
        "37:cymbal": "assets/37/cymbal.svg",
        "37:guitar": "assets/37/guitar.svg",
        "37:trumpet": "assets/37/trumpet.svg",
        "37:triangle": "assets/37/triangle.svg",

        "40:background": "assets/40/background.svg",
        "40:tip": "assets/40/tip.svg",
        "40:red_frame": "assets/40/wrong_frame.svg",

        "40:string-0": "assets/40/string-0.svg",
        "40:string-1": "assets/40/string-1.svg",
        "40:string-2": "assets/40/string-2.svg",
        "40:string-3": "assets/40/string-3.svg",
        "40:string-4": "assets/40/string-4.svg",
        "40:string-5": "assets/40/string-5.svg",
        "40:string-6": "assets/40/string-6.svg",
        "40:string-7": "assets/40/string-7.svg",

        "40:red": "assets/40/red.svg",
        "40:orange": "assets/40/orange.svg",
        "40:yellow": "assets/40/yellow.svg",
        "40:green": "assets/40/green.svg",
        "40:light_blue": "assets/40/light_blue.svg",
        "40:blue": "assets/40/blue.svg",
        "40:purple": "assets/40/purple.svg",
        "40:white": "assets/40/white.svg",

        "44:begin_point": "assets/44/begin_point.svg",
        "44:begin_text": "assets/44/begin_text.svg",
        "44:maze_room": "assets/44/maze_room.svg",
        "44:maze_spinner": "assets/44/maze_spinner.svg",
        "44:maze_text": "assets/44/maze_text.svg",

        "45:chest-closed": "assets/45/chest-closed.svg",
        "45:chest-open": "assets/45/chest-open.svg",
        "45:chest-open_with_treasure": "assets/45/chest-open_with_treasure.svg",
        "45:text-1": "assets/45/text-1.svg",

        "48:button": "assets/48/button.svg",
        "48:button-p": "assets/48/button-p.svg",
        "48:green_paint_bucket": "assets/48/green_paint_bucket.svg",
        "48:gray_paint_bucket": "assets/48/gray_paint_bucket.svg",
        "48:brown_paint_bucket": "assets/48/brown_paint_bucket.svg",

        "49:schoolbag-closed": "assets/49/schoolbag-closed.svg",
        "49:schoolbag-1-open": "assets/49/schoolbag-1-open.svg",
        "49:schoolbag-2-empty": "assets/49/schoolbag-2-empty.svg",
        "49:schoolbag-2-full": "assets/49/schoolbag-2-full.svg",
        "49:airpods": "assets/49/airpods.svg",
        "49:charger": "assets/49/charger.svg",
        "49:pen": "assets/49/pen.svg",
        "49:textbook-1": "assets/49/textbook-1.svg",
        "49:textbook-2": "assets/49/textbook-2.svg",
        "49:textbook-3": "assets/49/textbook-3.svg",
        "49:textbook-4": "assets/49/textbook-4.svg",
        "49:exercise_book-1": "assets/49/exercise_book-1.svg",
        "49:exercise_book-2": "assets/49/exercise_book-2.svg",
        "49:exercise_book-3": "assets/49/exercise_book-3.svg",
        "49:exercise_book-4": "assets/49/exercise_book-4.svg",
        "49:subject-1": "assets/49/subject-1.svg",
        "49:subject-2": "assets/49/subject-2.svg",
        "49:subject-3": "assets/49/subject-3.svg",
        "49:subject-4": "assets/49/subject-4.svg",

        "51:note": "assets/51/note.svg",
        "51:bean": "assets/51/bean.svg",
        "51:word-1": "assets/51/word-1.svg",
        "51:word-2": "assets/51/word-2.svg",

        "53:draggable_item": "assets/53/draggable_item.svg",
        "53:draggable_item-p": "assets/53/draggable_item-p.svg",
        "53:label-1": "assets/53/label-1.svg",
        "53:label-2": "assets/53/label-2.svg",
        "53:label-3": "assets/53/label-3.svg",
        "53:label-4": "assets/53/label-4.svg",
        "53:label-5": "assets/53/label-5.svg",
        "53:label-6": "assets/53/label-6.svg",

        "55:background": "assets/55/background.svg",

        "60:volleyball-1": "assets/60/volleyball-1.svg",
        "60:volleyball-2": "assets/60/volleyball-2.svg",
        "60:volleyball-3": "assets/60/volleyball-3.svg",
        "60:pump-case": "assets/60/pump-case.svg",
        "60:pump-press": "assets/60/pump-press.svg",

        "63:match": "assets/63/match.svg",

        "68:keyboard_button": "assets/68/keyboard_button.svg",
        "68:keyboard_button-p": "assets/68/keyboard_button-p.svg",
        "68:background": "assets/68/background.svg",
        "68:exercise_book-1": "assets/68/exercise_book-1.svg",
        "68:exercise_book-3": "assets/68/exercise_book-3.svg",
        "68:bottom_cover": "assets/68/bottom_cover.svg",

        "70:button-1": "assets/70/button-1.svg",
        "70:button-2": "assets/70/button-2.svg",
        "70:text-1": "assets/70/text-1.svg",
        "70:text-2": "assets/70/text-2.svg",

        "letter-1": "assets/letters/1.svg",
        "letter-2": "assets/letters/2.svg",
        "letter-3": "assets/letters/3.svg",
        "letter-4": "assets/letters/4.svg",
        "letter-5": "assets/letters/5.svg",
        "letter-6": "assets/letters/6.svg",
        "letter-7": "assets/letters/7.svg",
        "letter-8": "assets/letters/8.svg",
        "letter-9": "assets/letters/9.svg",
        "letter-10": "assets/letters/10.svg",
        "letter-11": "assets/letters/11.svg",
        "letter-12": "assets/letters/12.svg",
        "letter-13": "assets/letters/13.svg",
        "letter-14": "assets/letters/14.svg",
        "letter-15": "assets/letters/15.svg",
        "letter-16": "assets/letters/16.svg",
        "letter-17": "assets/letters/17.svg",
        "letter-18": "assets/letters/18.svg",
        "letter-19": "assets/letters/19.svg",
        "letter-20": "assets/letters/20.svg",
        "letter-21": "assets/letters/21.svg",
        "letter-22": "assets/letters/22.svg",
        "letter-23": "assets/letters/23.svg",
        "letter-24": "assets/letters/24.svg",
        "letter-25": "assets/letters/25.svg",
        "letter-26": "assets/letters/26.svg",
        "letter-27": "assets/letters/27.svg",
        "letter-28": "assets/letters/28.svg",
        "letter-29": "assets/letters/29.svg",
        "letter-30": "assets/letters/30.svg",
        "letter-31": "assets/letters/31.svg",
        "letter-32": "assets/letters/32.svg",

        "menus:game_complete_poster": "assets/menus/game_complete_poster.svg"
    },
    audio: {
        "menus:wind": "assets/sounds/menus-wind.wav",

        "40:start_game": "assets/sounds/40-start_game.wav",
        "40:correct": "assets/sounds/40-correct.wav",
        "45:open": "assets/sounds/45-open.wav",
        "45:close": "assets/sounds/45-close.wav",
        "45:treasure": "assets/sounds/45-treasure.wav",
        "49:zipper": "assets/sounds/49-zipper.wav",
        "49:wool": "assets/sounds/49-wool.wav",
        "50:arrow-let-go": "assets/sounds/50-arrow_let_go.wav",

        "51:piano-F": "assets/sounds/51-piano-F.wav",
        "51:piano-G": "assets/sounds/51-piano-G.wav",
        "60:inflate": "assets/sounds/60-inflate.wav",
        "68:write": "assets/sounds/68-write.wav",

        "beep": "assets/sounds/beep.wav",
        "ding": "assets/sounds/ding.wav",
        "explosion": "assets/sounds/explosion.wav",
        "game_over": "assets/sounds/game_over.wav",
        "pew": "assets/sounds/pew.wav",
        "tick": "assets/sounds/tick.wav",

        "game_complete": "assets/sounds/game_complete.wav"
    },
    masks: [
        "37:drum",
        "37:cymbal",
        "37:guitar",
        "37:trumpet",
        "37:triangle",
        "45:chest-closed",
        "button-next",
        "44:maze_collision",
        "44:maze_spinner_collision"
    ],
    nearestFilterImages: [],
    audioVolumeNodes: [],
}).catch((e)=>{
    displayError(e);
    console.error(e);
});

