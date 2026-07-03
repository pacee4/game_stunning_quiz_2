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

import { SButtonConfigurable } from "./sprites";


// QUESTION 70
export class SButton extends SButtonConfigurable {
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

export class SQuestionText extends TopSprite {
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
