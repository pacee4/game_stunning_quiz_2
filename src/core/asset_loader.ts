import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { soundManager } from '@/core/sound_manager';
import { showEl, hideEl } from '@/core/dom';

export let error = false;

export const gatheredAssets: {
    htmlImages: Record<string, HTMLImageElement>,
    canvases: Record<string, {c: HTMLCanvasElement, ctx: CanvasRenderingContext2D}>,
    textures: Record<string, Texture>,
    masks: Record<string, MaskParameters>
} = {
    htmlImages: {},
    canvases: {},
    textures: {},
    masks: {}
};

export interface HitboxParameters {
    /**
     * The offset by X from the sprite.
     */
    offsetX: number,
    /**
     * The offset by Y from the sprite.
     */
    offsetY: number,
    /**
     * The width of the hitbox.
     */
    width: number,
    /**
     * The height of the hitbox.
     */
    height: number,

    calculateOriginPoint?: boolean,

    matrix?: Uint8Array
}
export interface MaskParameters extends HitboxParameters {
    matrix: Uint8Array
}

export interface ResourcesToLoad {
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
    v: Texture
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

export async function loadAssets(resourcesToLoad: ResourcesToLoad){
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
        progressBarValue: <HTMLDivElement>document.getElementById("g-progressBarValue"),
        progressBarText: <HTMLDivElement>document.getElementById("g-progressBarText"),
        progressBarError: <HTMLDivElement>document.getElementById("g-progressBarError")
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
                const asset = await Assets.load<Texture>({
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
                await Assets.load({
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
                {
                    const contentType = response.headers.get("content-type");
                    if (!contentType || !contentType.startsWith("audio/")) {
                        throw new Error(`Cannot load audio: ${url}`);
                    }
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

export function displayError(reason: string) {
    if (!error) {
        error = true;
        const elProgressBarError = document.getElementById("g-progressBarError")!;

        showEl(document.getElementById("g-divProgressBar")!);
        hideEl(document.getElementById("g-divGame")!);
        showEl(elProgressBarError);

        document.getElementById("g-progressBarText")!.textContent = "Ошибка загрузки";
        elProgressBarError.textContent = reason;
    }
}