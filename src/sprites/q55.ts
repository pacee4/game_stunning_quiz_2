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


// QUESTION 55
export class SBackground extends TopSprite {
    constructor() {
        super("55:background");
        this.anchor.set(0, 0);
        this.position.set(0, 0);
    }
}

export class SQuestionText extends TopSprite {
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
