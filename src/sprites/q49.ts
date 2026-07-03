import * as PIXI from "pixi.js";
import * as F from "@/core/functions";
import { Msg, settings } from "@/editable";
import { dp, m, messages, layers } from "@/core/sensing_properties";
import { Sprite, TopSprite, TopContainer, CompHitbox, CompMask, CompGroup, HitboxParameters, MaskParameters } from "@/core/core";

import { AnimationSequence } from "@/custom";
import * as C from "@/custom";
import { soundManager } from "@/core/sound_manager";
import { g } from "./global_properties";
import { s } from "./storage";


// QUESTION 49
export class SDraggableItems extends TopSprite {
    clickHitbox: CompHitbox;
    clickable = true;

    startGrabRelX = 0;
    startGrabRelY = 0;

    pressed = false;

    /** allows only one item to be dragged */
    static draggingItem: SDraggableItems|null = null;

    constructor(public readonly item: string, x: number, y: number, dragging=false){
        super("49:"+item);
        // Question 49: collect items into a schoolbag
        // Question 55: take items from the schoolbag

        this.position.set(x, y);

        this.clickHitbox = new CompHitbox(this);

        if (dragging) {
            SDraggableItems.draggingItem = this;
        }
    }

    

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:

                // drag
                if (this.clickable) {
                    if (m.onePointerIsPressed() && this.clickHitbox.collidePointer(0)) {
                        SDraggableItems.draggingItem = this;
                    }

                    if (this.pressed) {
                        if (!m.pointerIsDown(0)) {
                            this.pressed = false;
                            SDraggableItems.draggingItem = null;

                            if (g.question === 55) {
                                    // put the item on the desk
                                    this.position.set(
                                        F.clamp(this.x, 91, 418),
                                        F.clamp(this.y, 216, 278)
                                    );
                                }
                            if (this.clickHitbox.collide(s.q49_schoolbag.children[0].dropHitbox)) {
                                s.q49_schoolbag.children[0].drop(this);
                            }

                            if (g.question === 55) {
                                SSchoolbag.checkQ55();
                            }
                        }
                        else {
                            // dragging
                            this.position.set(
                                F.clamp(this.startGrabRelX+m.mouseX, 0, 480),
                                F.clamp(this.startGrabRelY+m.mouseY, 0, 360)
                            );
                        }
                    }
                }
                break;

            case Msg.TICK_GAME_LOGIC:
                if (SDraggableItems.draggingItem === this && !this.pressed) {
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

export class SSchoolbag extends TopContainer {
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

    drop(draggableItem: SDraggableItems) {
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
            s.q49_draggable_items.addChild(new SDraggableItems(
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
                if (m.onePointerIsPressed() && this.extractHitbox.collidePointer(0)) {
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
                    if (!SDraggableItems.draggingItem) {
                        this.extract();
                    }
                    this.aboutToExtract = false;
                }

                SSchoolbag.animFinish.simulateTick();

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
            SSchoolbag.animFinish.start();
        }
    }
}