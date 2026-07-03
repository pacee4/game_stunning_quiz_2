import { Msg, settings } from "@/editable";
import { RenderLayer } from "pixi.js";

export const dp = window.devicePixelRatio;

// MESSAGE MANAGER
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
    hasMessages() {
        return (this.messages.length!==0);
    }
}
export const messages = new Messages();

interface KeyProperty {
    character: string,
    holding: boolean
}
interface PointerProperty {
    position: {x: number, y: number},
    holding: boolean
}

// SENSING PROPERTIES
class SensingProperties {
    resolutionHasChanged = false;

    get isResized() { return this.resolutionHasChanged; }
    isFocused = false;

    mouseX = -1;
    mouseY = -1;
    /** Determines whether the mouse or stylus cursor is hovering over the screen, as well as the number of fingers pressed on it. */
    hoveredPointerCount = 0;
    get pointerX() { return this.mouseX; }
    get pointerY() { return this.mouseY; }
    

    pointers = new Map<number, PointerProperty>();
    
    /** Virtual pointer ID 0 is also compatible with a mouse. */
    pointerIsDown(vId: number) {
        return this.pointers.has(vId);
    }
    /** Virtual pointer ID 0 is also compatible with a mouse. */
    pointerIsPressed(vId: number) {
        const touchProperty = this.pointers.get(vId);
        return (touchProperty ? (!touchProperty.holding) : false);
    }

    /** This method is also compatible with a mouse. */
    onePointerIsPressed() {
        return m.pointers.size === 1 && this.pointerIsPressed(0);
    }
    /** Virtual pointer ID 0 can also be the mouse. Returns -1 if none found. */
    getNewPointerId() {
        for (const [vId, pointerProperty] of this.pointers.entries()) {
            if (!pointerProperty.holding) return vId;
        }
        return -1;
    }

    // (OPTIONAL)
    get keys() {
        return this.keyboardCodes;
    }
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
    
    readonly isMobile = matchMedia("((max-width: 480px) or (max-height: 480px))").matches;

    
    readonly mediaTouchDevice = matchMedia("((pointer: coarse) and (not (any-pointer: fine)))");

    /** If the device is a computer, or a device with a mouse connected, the project
     * will handle mouse and keyboard inputs. Otherwise, touches are handled. */

    /** If the device is a computer, or a device with a mouse connected, the project
     * will handle mouse and keyboard inputs. Otherwise, touches are handled. */
    get isTouchDevice() { return this.mediaTouchDevice.matches; }
    get isComputer() { return !this.isTouchDevice; }
}
export const m = new SensingProperties();

// LAYERS
export const layers = Array<RenderLayer>(settings.MAX_LAYERS ?? 0).fill(new RenderLayer());
