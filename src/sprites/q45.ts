import * as PIXI from "pixi.js";
import * as F from "@/core/functions";
import { Msg, settings } from "@/editable";
import { dp, m, messages } from "@/core/sensing_properties";
import { Sprite, TopSprite, TopContainer, CompHitbox, CompMask, CompGroup, HitboxParameters, MaskParameters } from "@/core/core";

import { AnimationSequence } from "@/custom";
import * as C from "@/custom";
import { soundManager } from "@/core/sound_manager";
import { gatheredAssets } from "@/core/asset_loader";
import { g } from "./global_properties";
import { s } from "./storage";


// QUESTION 45
export class SController extends TopContainer {
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

        let sourceI = F.randomNumber(0, 2);
        let toI;
        do {
            toI = F.randomNumber(0, 2);
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

        const treasureI = F.randomNumber(0, 2);
        for (let i = 0; i < 3; i++) {
            s.q45_chests.addChild(new SChests(i, (i===treasureI)));
        }
        s.q45_text.instantiateOne();

        this.startShuffleChests();
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

export class SChests extends TopContainer {
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
            settings.SCREEN_WIDTH/2 - 130 + (this.i*130),
            settings.SCREEN_HEIGHT/2
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
        this.toX = settings.SCREEN_WIDTH/2 - 130 + (this.i*130);
    }

    endAnimMove() {
        if (this.moving) {
            this.moving = false;
            this.position.set(
                this.toX,
                settings.SCREEN_HEIGHT/2
            );
        }
    }

    tickAnimMove(t: C.AnimationTimeProperties) {
        if (this.moving) {
            let y = (
                (t.percent > 0.5)
                ? F.ease(F.scale(t.percent, 0, 0.5, 0, 1), "quadOut")*(this.movingDown?120:-120) + settings.SCREEN_HEIGHT/2
                : F.ease(F.scale(t.percent, 0.5, 1, 1, 0), "quadOut")*(this.movingDown?120:-120) + settings.SCREEN_HEIGHT/2
            );

            this.position.set(
                F.scale(t.percent, 0, 1, this.previousX, this.toX),
                y
            );
        }
    }

    pressed = false;
    focused = false;
    tintColorHolder = "#ffffff";

    private tickClick() {
        if (m.onePointerIsPressed() && this.clickMask.collidePointer(0)) {
            this.pressed = true;
        }
        if (this.pressed) {
            if (!m.pointerIsDown(0)) {
                if (this.focused) {
                    this.clickAction();
                }
                this.pressed = false;
            }

            this.focused = this.clickMask.collidePointer(0);
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

export class SText extends TopSprite {
    constructor() {
        super("45:text-1");
        this.position.set(0, 0);
        this.anchor.set(0, 0);
        this.visible = false;
    }
}
