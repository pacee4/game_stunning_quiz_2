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

import { SButtonConfigurable } from "./sprites";


// QUESTION 63
export class SController extends TopContainer {
    step!: number;
    aboutToWin!: boolean;
    clickedMatches: SMatches[] = [];

    private animFinish = new AnimationSequence().createState({
        duration: 2,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });
    
    constructor() {
        super();
        this.init();

        s.q63_matches.addChild(
            new SMatches(310, 120, 3),

            new SMatches(310, 184, 1),
            new SMatches(240, 184, 3),

            new SMatches(310, 248, 1),
            new SMatches(240, 248, 1),
            new SMatches(170, 248, 3),

            new SMatches(310, 312, 1),
            new SMatches(240, 312, 1, true),
            new SMatches(170, 312, 1),

            new SMatches(275, 152, 0),
            new SMatches(345, 152, 0),

            new SMatches(205, 216, 0),
            new SMatches(275, 216, 0),
            new SMatches(345, 216, 0, true),

            new SMatches(135, 280, 0),
            new SMatches(205, 280, 0),
            new SMatches(275, 280, 0),
            new SMatches(345, 280, 0),
        );
    }

    init() {
        this.step = 0;
        this.aboutToWin = true;
        this.clickedMatches.splice(0); // clear
    }

    processClick(match: SMatches) {
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
export class SMatches extends SButtonConfigurable {
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
                this.tint = C.getColorFromGradient(["#ff0000", "#ffffff"], t.percent);
            }
        });
    animDisappear = new AnimationSequence()
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.alpha = F.scale(t.percent, 0, 1, 0.25, 0);
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
