import * as PIXI from "pixi.js";
import * as F from "@/core/functions";
import { Msg, settings } from "@/editable";
import { dp, m, messages } from "@/core/sensing_properties";
import { Sprite, TopSprite, TopContainer, CompHitbox, CompMask, CompGroup, HitboxParameters, MaskParameters } from "@/core/core";

import { AnimationSequence } from "@/custom";
import * as C from "@/custom";
import { soundManager } from "@/core/sound_manager";
import { g } from "./global_properties";
import { s } from "./storage";


export class SController extends TopContainer {
    static readonly CORRECT_ORDERS = ["123456", "213456", "124356", "214356", "654321", "654312", "653421", "653412"];

    constructor() {
        super();

        const numbers = [1, 2, 3, 4, 5, 6];
        for (let i = 0; i < 6; i++) {
            s.q53_draggable_items.addChild(new SDraggableItems(
                i,
                numbers.splice(F.randomNumber(0, numbers.length-1), 1)[0],
            ));
        }
    }

    checkAnswer(): boolean {
        for (let i = 0; i < 6; i++) {
            const gottenID = s.q53_draggable_items.children.find((sp)=>(sp.pos === i))!.id;
            let hasMatch = false;
            for (const correctOrder of SController.CORRECT_ORDERS) {
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

export class SDraggableItems extends TopContainer {
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
                this.y = F.scale(F.ease(t.percent, "quadOut"), 0, 1, this.prevY, this.targetY);
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
            if (m.onePointerIsPressed() && this.clickHitbox.collidePointer(0)) {
                this.pressed = true;
                s.q53_draggable_items.children.forEach((sp)=>{if (sp!==this) sp.zIndex = 0;});
                this.zIndex = 1;
                s.q53_draggable_items.sortChildren();

                this.startGrabRelY = this.y-m.mouseY;
            }
            if (this.pressed) {
                
                if (!m.pointerIsDown(0)) {
                    this.pressed = false;
                    this.animMoveToPos.start();
                }
                else {
                    // dragging
                    this.y = F.clamp(this.startGrabRelY+m.mouseY, 138, 288);

                    const actualPos = Math.round((this.y-138)/30);
                    if (this.pos !== actualPos) {
                        // this item has moved to another position index
                        const sideN = Math.sign(this.pos - actualPos);

                        s.q53_draggable_items.children.filter((sp)=>(
                            F.isBetween(sp.pos, this.pos-sideN, actualPos)
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
