import * as PIXI from "pixi.js";
import * as F from "@/core/functions";
import { soundManager } from "@/core/sound_manager";

import { Msg, settings } from "@/editable";
import { m, messages, dp } from "@/core/sensing_properties";
import { MaskParameters, ResourcesToLoad, loadAssets, gatheredAssets } from "@/core/asset_loader";
import { SpriteStorage } from "@/sprites/storage";
import { showEl, hideEl, els, UI } from "@/core/dom";

if (import.meta.env.DEV) {
    import("@/core/debug_tools").then((module)=>{
        window.debugTools = new module.DebugTools();
    });
}

/** The text will always remain smooth at any screen zoom. */
export class SmoothText extends PIXI.Text {
    constructor(options?: PIXI.CanvasTextOptions) {
        super(options);

        // add
        screen.holder.texts.add(this);
        screen.updateTextResolution(this);
        // handle destroy
        this.addListener("destroyed", ()=>{
            screen.holder.texts.delete(this);
        });
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

    createMask(image: HTMLImageElement, alphaThreshold=0.5): MaskParameters {
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
        return {
            offsetX: 0,
            offsetY: 0,
            width: width,
            height: height,
            matrix: matrix,
            calculateOriginPoint: true
        };
    }

    static createMaskFromPixels(data: PIXI.GetPixelsOutput, alphaThreshold=0.5): MaskParameters {
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
 
//! SCREEN
class Screen {
    private app;
    private realScale = 0;
    private integerResolution = 0;
    private offscreenRenderer;
    private screenSprite;
    private antialias;
    private LOGICAL_WIDTH = settings.SCREEN_WIDTH;
    private LOGICAL_HEIGHT = settings.SCREEN_HEIGHT;
    private s!: SpriteStorage;

    private readonly divCanvasPos = {x: 0, y: 0}; // need for correct mouse/pointer position

    private readonly virtualIds = new Map<number, number>();
    
    readonly holder: {
        texts: Set<SmoothText>
    } = {
        texts: new Set()
    }

    constructor(private quality: "low"|"high" = "high") {
        this.antialias = (this.quality === "high");
        this.app = new PIXI.Application();

        this.offscreenRenderer = PIXI.RenderTexture.create({
            width: this.LOGICAL_WIDTH,
            height: this.LOGICAL_HEIGHT,
            dynamic: true, // so that it can visually resize
            resolution: dp, // set the offscreen resolution here too
            
            antialias: this.antialias,
        });

        // screen display sprite
        this.screenSprite = new PIXI.Sprite(this.offscreenRenderer);
        this.screenSprite.position.set(0, 0);
    }
 
    public async init(resourcesToLoad: ResourcesToLoad) {
        // set up the application
        await this.app.init({
            resizeTo: els.divCanvas,
            antialias: this.antialias,
            resolution: dp,
            backgroundColor: "#f0f0f0"
        });
        this.app.canvas.id = "canvas";

        // load assets and wait
        await loadAssets(resourcesToLoad);

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

        // change scaling mode of some images to nearest
        if (resourcesToLoad.nearestFilterImages) {
            for (let key of resourcesToLoad.nearestFilterImages) {
                gatheredAssets.textures[key].source.scaleMode = "nearest";
            }
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
        this.s = new SpriteStorage();
        this.s.takeNewFromObjects();

        // add the screen sprite
        this.app.stage.interactiveChildren = false;
        this.app.stage.accessibleChildren = false;
        this.app.stage.addChild(this.screenSprite);
        
        // add ticker
        this.app.ticker.add((time)=>{
            if (window.debugTools && window.debugTools.isShown()) {
                window.debugTools.updateDebugInfo(time.deltaMS/1000);
            }
            try {
                if ((!window.debugTools) || (!window.debugTools.paused)) {
                    // STEP 1: measure time
                    m.delta = time.deltaMS/1000;
                    if (m.delta > 0.5) {m.delta = 0;}
                    m.time += m.delta;
                    
                    // STEP 2: handle the logic of objects
                    this.s.updateObjects();

                    // STEP 3: draw
                    this.renderOffscreen();

                    // STEP 4: pass user input
                    for (let value of m.keyboardCodes.values()) {
                        if (!value.holding) {
                            value.holding = true;
                        }
                    }
                    for (let value of m.pointers.values()) {
                        if (!value.holding) {
                            value.holding = true;
                        }
                    }

                    if (m.resolutionHasChanged) {m.resolutionHasChanged = false;}

                    if (window.debugTools && window.debugTools.logMessages) {
                        console.log(`Messages: ${window.debugTools.calledMessages.map(msg=>msg.toString()).join(", ")}`);
                        window.debugTools.calledMessages.splice(0);
                    }
                }
            }
            catch(error){
                this.app.ticker.stop();console.error(error);alert(error);
                if (window.debugTools && window.debugTools.logMessages) {
                    console.log(`Messages: ${window.debugTools.calledMessages.map(msg=>msg.toString()).join(", ")}`);
                }
            }
        });
        this.setEventListeners();

        // set width and height of #divCanvasElements
        els.divCanvasElements.style.width = `${this.LOGICAL_WIDTH}px`;
        els.divCanvasElements.style.height =`${this.LOGICAL_HEIGHT}px`;

        // Show game
        els.divCanvas.insertBefore(this.app.canvas, els.divCanvas.firstChild);
        hideEl(document.getElementById("g-divProgressBar")!);
        showEl(els.divGame);
        
        // important on load
        this.onResize();
        messages.broadcast(Msg.START);
    }


    private getPointerPos(event: PointerEvent) {
        return {
            x: F.clamp(((event.clientX-this.divCanvasPos.x) / this.realScale), 0, this.LOGICAL_WIDTH),
            y: F.clamp(((event.clientY-this.divCanvasPos.y) / this.realScale), 0, this.LOGICAL_HEIGHT)
        };
    }
    private deleteVirtualId(event: PointerEvent) {
        const realPointerId = event.pointerId;
        if (els.divCanvas.hasPointerCapture(realPointerId)) {
            els.divCanvas.releasePointerCapture(realPointerId);
        }

        const vId = this.virtualIds.get(realPointerId);
        if (vId === undefined) return;
        m.pointers.delete(vId);
        this.virtualIds.delete(realPointerId);
    }

    private registerVirtualId(realPointerId: number) {
        const values = Array.from(this.virtualIds.values());
        for (let i = 0; i < 10; i++) {
            if (!values.includes(i)) {
                this.virtualIds.set(realPointerId, i);
                return i;
            }
        }
        return realPointerId;
    }


    private handleEventKeyDown = (event: KeyboardEvent) => {
        if (UI.gameIsFocused) {
            m.simulateKeyDown(event.code, event.key);
        }
    }
    private handleEventKeyUp = (event: KeyboardEvent) => {
        if (UI.gameIsFocused) {
            m.simulateKeyUp(event.code);
        }
    }

    private setEventListeners() {
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


        // pointer interaction
        els.divCanvas.addEventListener("pointerdown", (event: PointerEvent)=>{
            if (event.pointerType === "mouse" && event.button !== 0) return;

            if (event.pointerType !== "mouse") {
                els.divCanvas.setPointerCapture(event.pointerId); // to avoid the bug that shows context menu when the right mouse button clicked while the left button is being held
            }
            const vId = this.registerVirtualId(event.pointerId);
            
            const pointerPos = this.getPointerPos(event);
            m.pointers.set(vId, {
                position: pointerPos,
                holding: false
            });

            if (vId === 0) {
                m.mouseX = pointerPos.x;
                m.mouseY = pointerPos.y;
            }
        });
        els.divCanvas.addEventListener("pointermove", (event: PointerEvent)=>{
            const vId = this.virtualIds.get(event.pointerId);

            if (event.pointerType !== "mouse" && vId === undefined) return;
            const pointerPos = this.getPointerPos(event);
            if (event.pointerType === "mouse" || vId === 0) {
                m.mouseX = pointerPos.x;
                m.mouseY = pointerPos.y;
            }

            if (vId === undefined) return;
            const pointerProperty = m.pointers.get(vId);
            if (pointerProperty) {
                pointerProperty.position.x = pointerPos.x;
                pointerProperty.position.y = pointerPos.y;
            }
        });
        els.divCanvas.addEventListener("pointerup", this.deleteVirtualId.bind(this));
        els.divCanvas.addEventListener("pointercancel", this.deleteVirtualId.bind(this));
        
        els.divCanvas.addEventListener("pointerenter", (event)=>{
            m.hoveredPointerCount+=1;
        })
        els.divCanvas.addEventListener("pointerleave", (event)=>{
            m.hoveredPointerCount-=1;
            if (event.pointerType === "mouse") {
                this.deleteVirtualId(event);
            }
        });

        // keyboard (OPTIONAL)
        m.mediaTouchDevice.addEventListener("change", ()=>{
            if (m.mediaTouchDevice.matches) {
                document.removeEventListener("keydown", this.handleEventKeyDown);
                document.removeEventListener("keyup", this.handleEventKeyUp);
            }
            else {
                document.addEventListener("keydown", this.handleEventKeyDown);
                document.addEventListener("keyup", this.handleEventKeyUp);
            }
        });
        if (!m.mediaTouchDevice.matches) {
            document.addEventListener("keydown", this.handleEventKeyDown);
            document.addEventListener("keyup", this.handleEventKeyUp);
        }
        document.addEventListener("custom-switchgamefocus", ()=>{
            if (!UI.gameIsFocused) {
                for (const code of m.keyboardCodes.keys()) {
                    m.simulateKeyUp(code);
                }
            }
        });

        // input fields
        {
            const inputs = document.querySelectorAll("#g-divCanvasElements input, #g-divCanvasElements textarea");
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
        UI.setGameEvents();
        // disable pull-to-refresh for mobile devices
        document.documentElement.style.overscrollBehavior = "none";

        // disable right-click context menu
        els.divCanvas.addEventListener("contextmenu", (event)=>{
            const target = <HTMLElement|null>event.target;
            if (target && (target.id === "canvas" || target.id === "g-divCanvasElements" || target.classList.contains("transparent"))) {
                event.preventDefault(); // stop context menu
            }
        });
    }


    private renderOffscreen() {
        // render the original container to the intermediate this.offscreenRenderer
        this.app.renderer.render({
            container: this.s.container,
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
            this.divCanvasPos.x = divCanvasClientRect.x;
            this.divCanvasPos.y = divCanvasClientRect.y;
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
        this.s.container.scale = this.realScale;
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
        for (let text of this.holder.texts) {
            text.resolution = this.integerResolution;
        }
    }


    public changeQuality(quality: "low"|"high") {
        if (quality !== this.quality) {
            this.quality = quality;
            console.log("change quality to "+quality);
            this.antialias = (this.quality === "high");

            // recreate the renderer
            {
                this.offscreenRenderer.destroy();
                this.offscreenRenderer = PIXI.RenderTexture.create({
                    width: this.LOGICAL_WIDTH,
                    height: this.LOGICAL_HEIGHT,
                    dynamic: true, // so that it can visually resize
                    resolution: dp, // set the offscreen resolution here too
                    
                    antialias: this.antialias,
                });
                this.updateScaleContainer(
                    this.LOGICAL_WIDTH * this.realScale,
                    this.LOGICAL_HEIGHT * this.realScale
                );
                this.screenSprite.texture = this.offscreenRenderer;
            }

            
        }
    }


    public updateTextResolution(text: SmoothText) {
        text.resolution = this.integerResolution;
    }


    public graphicsToTexture(graphics: PIXI.Graphics) {
        return this.app.renderer.generateTexture({
            target: graphics,
            resolution: this.integerResolution,
            antialias: this.antialias
        });
    }
}
//#endregion
export const screen = new Screen();