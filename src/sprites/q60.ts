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


// QUESTION 60
export class SVolleyball extends TopContainer {
    animPump = new AnimationSequence(()=>{
        this.elasticity++;
        this.prevScaleX = this.scale.x;
        this.prevScaleY = this.scale.y;
        this.prevAlpha = this.s2.alpha;

        if (this.elasticity >= 25) {
            console.log("pumped up");
            s.q60_pump.children[0].letGo();
            s.main.gameTick = false;
            this.animRoll.start();
        }
    })
        .createState({
            duration: 0.5,
            onTick: (t)=>{
                this.scale.set(
                    F.scale(F.ease(t.percent, "sineInOut"), 0, 1, this.prevScaleX, F.scale(this.elasticity, 0, 25, 1.4, 1)),
                    F.scale(F.ease(t.percent, "sineInOut"), 0, 1, this.prevScaleY, F.scale(this.elasticity, 0, 25, 0.2, 1))
                );
                this.s2.alpha = F.scale(t.percent, 0, 1, this.prevAlpha, F.scale(this.elasticity, 0, 25, 0, 1));
            }
        });

    animRoll = new AnimationSequence()
        .createState({
            offset: 1,
            duration: 1,
            onStart: (t)=>{
                this.s1.anchor.y = 0.5;
                this.s1.y -= this.s1.height/2;
            },
            onTick: (t)=>{
                this.s1.rotation = F.scale(t.percent, 0, 1, 0, Math.PI*1.5);
                this.x = F.scale(t.percent, 0, 1, 161, 161-(149*1.5));
            },
            onFinish: ()=>{
                s.main.nextQuestion();
            }
        });

    s1 = new Sprite("60:volleyball-1");
    s2 = new Sprite("60:volleyball-2");
    s3 = new Sprite("60:volleyball-3");

    prevScaleX = 0;
    prevScaleY = 0;
    prevAlpha = 0;

    elasticity = 0;
    
    constructor() {
        super();
        this.s1.anchor.set(0.5, 1);
        this.s2.anchor.set(0.5, 1);
        this.s3.anchor.set(0.5, 1);

        this.position.set(161, 291);
        this.addChild(this.s1, this.s2, this.s3);

        // initial state
        this.scale.set(1.4, 0.2);
        this.s2.alpha = 0;
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                this.animPump.simulateTick();
                this.animRoll.simulateTick();
                break;
        }
    }
}

export class SPump extends TopContainer {
    animLetGo = new AnimationSequence(()=>{
        this.prevY = this.s_press.y;
    })
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.s_press.y = F.scale(F.ease(t.percent, "quadOut"), 0, 1, this.prevY, 0);
            }
        });
    
    s_case = new Sprite("60:pump-case");
    s_press = new Sprite("60:pump-press");
    clickHitbox = new CompHitbox(this.s_press, {offsetX: 306, offsetY: 79, width: 88, height: 30});
    constructor() {
        super();
        this.s_case.anchor.set(0, 0);
        this.s_press.anchor.set(0, 0);

        this.addChild(this.s_press, this.s_case);
    }

    private startGrabRelY = 0;
    private prevY = 0;

    private pressed = false;

    private canPump = true;

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                if ((!this.pressed) && m.pointerIsPressed(0) && this.clickHitbox.collidePointer(0)) {
                    this.pressed = true;
                    this.startGrabRelY = this.s_press.y-m.mouseY;
                    this.animLetGo.stop();
                }
                if (this.pressed) {
                    if (!m.pointerIsDown(0)) {
                        this.pressed = false;
                        this.animLetGo.start();
                    }
                    else {
                        // dragging
                        this.s_press.y = F.clamp(this.startGrabRelY+m.mouseY, 0, 75);

                        if (this.s_press.y >= 75 && this.canPump) {
                            this.canPump = false;
                            soundManager.produce("60:inflate");
                            s.q60_volleyball.children[0].animPump.start();
                        }
                    }
                }
                break;

            case Msg.TICK_GAME_LOGIC:
                if (this.s_press.y <= 0 && !this.canPump) {
                    this.canPump = true;
                }
                this.animLetGo.simulateTick();
                break;
        }
    }

    letGo() {
        this.pressed = false;
        this.animLetGo.start();
    }
}
