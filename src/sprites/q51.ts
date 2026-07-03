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


// QUESTION 51
export class SBeanAndController extends TopContainer {
    private animShake = new AnimationSequence()
        .createState({
            duration: 0.05,
            onTick: (t)=>{
                const shakeP = (this.reverse) ? (-this.shakeAdditionP) : (this.shakeAdditionP);
                const shake = (this.reverse) ? (-this.shakeAddition) : (this.shakeAddition);
                const scaleX = F.scale(t.percent, 0, 1, 1+shakeP, 1-shake);
                const scaleY = F.scale(t.percent, 0, 1, 1-shakeP, 1+shake);
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
