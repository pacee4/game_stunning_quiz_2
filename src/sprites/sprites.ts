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

import { SSchoolbag } from "./q49";


export class GBackground extends TopContainer {
    constructor() {
        super();
        const g_background = new PIXI.Graphics().rect(0, 0, 480, 360).fill("#ffffff");

        this.addChild(g_background);
    }
}


export class SButtonConfigurable extends TopSprite {
    pressed = false;
    focused = false;
    clickable = true;
    clickHitbox: CompMask|CompHitbox;
    
    clickAction: (obj: SButtonConfigurable)=>void;

    readonly clickProcessMessage: Msg;
    textureKeys: {idle: string, pressed?: string};
    tintColors: {idle: string, pressed: string};

    protected tintColorH = "#ffffff";

    constructor(
        p: {
            idle: string,
            x: number,
            y: number,
            anchor?: {x: number, y: number};
            pressed?: string,
            idleTintColor?: string,
            pressedTintColor?: string,
            clickHitboxProps?: HitboxParameters|MaskParameters
            clickAction?: (obj: SButtonConfigurable)=>void,
            clickProcessMessage?: Msg
        }
    ) {
        super();
        this.textureKeys = {idle: p.idle, pressed: p.pressed};
        this.tintColors = {idle: (p.idleTintColor) ?? "#ffffff", pressed: (p.pressedTintColor) ?? "#808080"};

        this.clickAction = (p.clickAction) ?? (()=>{});
        this.clickProcessMessage = (p.clickProcessMessage) ?? (Msg.TICK);

        // set hitbox
        this.updateVisual();
        if (p.clickHitboxProps && p.clickHitboxProps.matrix) {
            // if the object has a hitbox, then it is a mask
            this.clickHitbox = new CompMask(this, <MaskParameters>p.clickHitboxProps);
            this.clickHitbox.calculateOriginPoint();
        }
        else {
            this.clickHitbox = new CompHitbox(this, p.clickHitboxProps);
        }
        this.position.set(p.x, p.y);
        if (p.anchor) {
            this.anchor.set(p.anchor.x, p.anchor.y);
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case this.clickProcessMessage:
                this.clickTick();
                break;
        }
    }

    protected clickTick() {
        if (m.onePointerIsPressed() && this.clickHitbox.collidePointer(0) && this.clickable) {
            this.pressed = true;
        }
        if (this.pressed) {
            if (!m.pointerIsDown(0)) {
                this.pressed = false;
                if (this.focused) {
                    this.clickAction(this);
                }
            }

            this.focused = this.clickHitbox.collidePointer(0);
        }

        if (this.clickable) {
            this.updateVisual();
        }
    }
    protected updateVisual() {
        let textureKey: string;
        // if the sprite has a texture on press
        if (this.textureKeys.pressed) {
            textureKey = (this.pressed && this.focused) ? this.textureKeys.pressed : this.textureKeys.idle;
        }
        else {
            textureKey = this.textureKeys.idle;
            const tintColor = (this.pressed && this.focused) ? this.tintColors.pressed : this.tintColors.idle;
            if (this.tintColorH !== tintColor) {
                this.tintColorH = tintColor;
                this.tint = tintColor;
            }
        }
        this.changeTextureKeyTick(textureKey);
    }
}

// menu: caution
export class SCautionPoster extends TopSprite {
    constructor() {
        super("menus:caution");
        this.anchor.set(0, 0);
        this.disable();
    }
}

export class SButtonContinue extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-continue",
            pressed: "menus:button-continue-p",
            x: 240,
            y: 300,
            clickHitboxProps: {offsetX: -128, offsetY: -22, width: 256, height: 37},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                messages.broadcast(Msg.CLOSE_CAUTION);
                messages.broadcast(Msg.SHOW_MENU);
            }
        });
        this.disable();
    }
}

// menu
export class STitle extends TopContainer {
    private s_title1 = new Sprite("title-1");
    private s_title2 = new Sprite("title-2");
    private s_title3 = new Sprite("title-3");
    private s_title1_blurFilter = new PIXI.BlurFilter();
    private s_title2_blurFilter = new PIXI.BlurFilter();
    private s_title3_blurFilter = new PIXI.BlurFilter();

    private animState = 0;

    anim = {
        e1P: new AnimationSequence(()=>{
            this.s_title1.visible = true;
            this.s_title2.visible = false;
            this.s_title3.visible = false;
        })
            .createState({
                duration: 1,
                onStart: ()=>{
                    this.s_title1.x = 240;
                    this.s_title1.position.set(240, 510);
                    this.s_title1.rotation = (Math.PI*-0.15);
                },
                onTick: (t)=>{
                    this.s_title1.y += F.scale(F.ease(t.percent, "quadOut"), 0, 1, -800, -80) * m.delta;
                    this.s_title1.rotation += F.scale(F.ease(t.percent, "quadOut"), 0, 1, (Math.PI*6), (Math.PI*0.2)) * m.delta;
                }
            })
            .createState({
                offset: 1.0,
                duration: 0.5,
                onTick: (t)=>{
                    this.s_title1.y += (-80)*m.delta;
                    this.s_title1.rotation += (Math.PI*0.2)*m.delta;
                }
            })
            .createState({
                offset: 1.0+0.5,
                duration: 0.8,
                onTick: (t)=>{
                    this.s_title1.y += F.scale(F.ease(t.percent, "quadIn"), 0, 1, -80, -1000) * m.delta;
                    this.s_title1.rotation += F.scale(F.ease(t.percent, "quadIn"), 0, 1, (Math.PI*0.2), (Math.PI*8)) * m.delta;

                    this.s_title1.alpha = F.ease(1-t.percent, "quadOut");
                },
                onFinish: ()=>{
                    this.s_title1.visible = false;
                    this.s_title1.alpha = 1;

                    this.s_title2.visible = true;
                    this.s_title2.x = 358;
                }
            })
            .createState({
                offset: 1.0+0.5+0.8,
                duration: 1.3,
                onTick: (t)=>{
                    this.s_title2.y = F.scale(F.ease(t.percent, "quadOut"), 0, 1, 360+36, 113+80);
                    this.s_title2.rotation = F.scale(F.ease(t.percent, "quadOut"), 0, 1, -Math.PI, 0);
                }
            })
            .createState({
                offset: 1.0+0.5+0.8+1.5,
                duration: 0.8,
                onStart: (t)=>{
                    this.s_title1.visible = true;
                    this.s_title1.position.set(219, -118);
                },
                onTick: (t)=>{
                    this.s_title1.y = F.scale(F.ease(t.percent, "quadOut"), 0, 1, -118, 77+80);
                    this.s_title1.rotation = F.scale(F.ease(t.percent, "quadOut"), 0, 1, -Math.PI, 0);
                }
            })
            .createState({
                offset: 1.0+0.5+0.8+1.5+0.8,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title3.visible = true;
                    this.s_title3.position.set(245, 159+80);
                    this.s_title3.filters = [this.s_title3_blurFilter];
                    this.s_title3_blurFilter.strength = 0;
                },
                onTick: (t)=>{
                    this.s_title3.alpha = t.percent;
                    this.s_title3.scale.set(F.scale(F.ease(t.percent, "quadIn"), 0, 1, 2, 1));
                    this.s_title3_blurFilter.strength = F.scale(t.percent, 0, 1, 30, 0);

                    if (t.percent >= 1) {
                        this.s_title3.filters = [];
                    }
                }
            })
            .createState({
                offset: 1.0+0.5+0.8+1.5+0.8+1.2,
                duration: 1.6,
                onStart: (t)=>{
                    s.button_play_part_link.children[0].visible = true;
                    s.button_play.children[0].visible = true;
                    s.button_how_to_play.children[0].visible = true;

                    s.main.animMoveIn.start(false, t.time);
                },
                onTick: (t)=>{
                    this.s_title1.y = F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 77+80, 77);
                    this.s_title2.y = F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 113+80, 113);
                    this.s_title3.y = F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 159+80, 159);
                }
            }),

        e2P: new AnimationSequence()
            .createState({
                duration: 0.8,
                onTick: (t)=>{
                    this.y = F.scale(F.ease(t.percent, "quadOut"), 0, 1, 0, 80);
                }
            })
            .createState({
                offset: 0.8,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title1.filters = [this.s_title1_blurFilter];
                },
                onTick: (t)=>{
                    this.s_title1.position.set(
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 219, 219-130),
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 77, 77-20)
                    );
                    this.s_title1.scale.set(
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 1, 1.5)
                    );
                    this.s_title1_blurFilter.strength = F.scale(t.percent, 0, 1, 0, 10);
                }
            })
            .createState({
                offset: 0.8+0.4,
                duration: 0.4,
                onTick: (t)=>{
                    this.s_title1.alpha = 1-t.percent;
                },
                onFinish: ()=>{
                    this.s_title1.visible = false;
                }
            })
            .createState({
                offset: 1.2,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title2.filters = [this.s_title2_blurFilter];
                },
                onTick: (t)=>{
                    this.s_title2.position.set(
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 358, 358+100),
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 113, 113-20)
                    );
                    this.s_title2.scale.set(
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 1, 1.5)
                    );
                    this.s_title2_blurFilter.strength = F.scale(t.percent, 0, 1, 0, 10);
                }
            })
            .createState({
                offset: 1.2+0.4,
                duration: 0.4,
                onTick: (t)=>{
                    this.s_title2.alpha = 1-t.percent;
                },
                onFinish: ()=>{
                    this.s_title2.visible = false;
                }
            })
            .createState({
                offset: 1.6,
                duration: 0.8,
                onStart: ()=>{
                    this.s_title3.filters = [this.s_title3_blurFilter];
                },
                onTick: (t)=>{
                    this.s_title3.scale.set(
                        F.scale(F.ease(t.percent, "quadOut"), 0, 1, 1, 1.5)
                    );
                    this.s_title3_blurFilter.strength = F.scale(t.percent, 0, 1, 0, 30);
                }
            })
            .createState({
                offset: 1.6+0.4,
                duration: 0.4,
                onTick: (t)=>{
                    this.s_title3.alpha = 1-t.percent;
                },
                onFinish: ()=>{
                    this.s_title3.visible = false;
                    this.destroy();
                }
            })
    };

    private animArray = Object.values(this.anim);

    constructor() {
        super();

        this.s_title1_blurFilter.resolution = dp;
        this.s_title1_blurFilter.strength = 0;
        this.s_title2_blurFilter.resolution = dp;
        this.s_title2_blurFilter.strength = 0;
        this.s_title3_blurFilter.resolution = dp;
        this.s_title3_blurFilter.strength = 0;

        this.s_title1.position.set(219, 77);
        this.s_title2.position.set(358, 113);
        this.s_title3.position.set(245, 159);

        this.addChild(this.s_title3, this.s_title1, this.s_title2);

        this.disable();
    }

    reset1() {
        this.animState = 0;
        this.enable();
        this.anim.e1P.start();
    }
    reset2() {
        this.animState = 2;
        this.enable();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                for (const animEffect of this.animArray) {
                    animEffect.simulateTick();
                }
                break;
        }
    }

    animMoveInTick(t: number) {
        if (this.enabled && this.animState === 2) {
            this.s_title1.position.set(
                F.scale(F.ease(t, "quadOut"), 0, 1, -212, 219),
                F.scale(F.ease(t, "quadOut"), 0, 1, 77-60, 77)
            );
            this.s_title2.position.set(
                F.scale(F.ease(t, "quadOut"), 0, 1, 587, 358),
                F.scale(F.ease(t, "quadOut"), 0, 1, 113-60, 113)
            );
            this.s_title3.position.y = (
                F.scale(F.ease(t, "quadOut"), 0, 1, 0-20, 159)
            );
            this.s_title3.alpha = t;
        }
    }
}


export class SEffectPlainCover extends TopContainer {
    private g_background = new PIXI.Graphics().rect(0, 0, 480, 360).fill("#ffffff");
    
    constructor() {
        super();

        this.addChild(this.g_background);

        this.disable();
    }

    animEffect1 = new AnimationSequence(()=>{
        this.g_background.tint = "#a3825c";
    })
        .createState({
            duration: 1.6,
            onTick: (t)=>{
                this.alpha = t.percent;
            }
        })
    animEffect2 = new AnimationSequence(()=>{
        this.g_background.tint = "#ffffff";
    })
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
            },
            onFinish: ()=>{
                this.disable();
            }
        })

    animPlay() {
        this.enable();
        this.animEffect1.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                this.animEffect1.simulateTick();
                this.animEffect2.simulateTick();
                break;
        }
    }
}


export class SButtonPlay extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-play",
            pressed: "menus:button-play-p",
            x: 240,
            y: 265,
            clickHitboxProps: {offsetX: -78, offsetY: -18, width: 156, height: 34},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                messages.broadcast(Msg.PLAY_CLICKED);
            }
        });

        this.disable();
    }

    reset1() {
        this.enable();
        this.visible = false;
        this.startY = 265+230;
    }

    reset2() {
        this.enable();
        this.startY = 265+130;
    }

    private startY = 265+130;
    private readonly endY = 265;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = F.scale(F.ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

export class SButtonHowToPlay extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-how_to_play",
            pressed: "menus:button-how_to_play-p",
            x: 240,
            y: 320,
            clickHitboxProps: {offsetX: -109, offsetY: -18, width: 218, height: 34},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                messages.broadcast(Msg.HIDE_MENU);
                messages.broadcast(Msg.SHOW_INSTRUCTIONS);
            }
        });

        this.disable();
    }

    reset1() {
        this.enable();
        this.visible = false;
        this.startY = 320+230;
    }

    reset2() {
        this.enable();
        this.startY = 320+130;
    }

    private startY = 320+130;
    private readonly endY = 320;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = F.scale(F.ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

export class SButtonPlayPartLink extends SButtonConfigurable {
    private eA = document.createElement("a");
    
    constructor() {
        super({
            idle: "menus:button-play_part",
            pressed: "menus:button-play_part-p",
            x: 240,
            y: 199,
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                document.body.appendChild(this.eA);
                this.eA.click();
                document.body.removeChild(this.eA);
            }
        });

        this.disable();

        this.eA.href = "https://pacee4.github.io/game_stunning_quiz_1";
        this.eA.target = "_blank";
        this.eA.rel = "noopener noreferrer";
        this.eA.classList.add("hide");
    }

    reset1() {
        this.enable();
        this.visible = false;
        this.startY = 199+230;
    }

    reset2() {
        this.enable();
        this.startY = 199-220;
    }

    private startY = 199-220;
    private readonly endY = 199;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = F.scale(F.ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

export class SInstructionsPoster1 extends TopSprite {
    constructor() {
        super("menus:instructions-1");
        this.anchor.set(0, 0);
        this.disable();
    }

    reset() {
        this.enable();
    }

    private readonly startY = -240;
    private readonly endY = 0;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = F.scale(F.ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

export class SInstructionsPoster2 extends TopContainer {
    private s_text = new Sprite("menus:instructions-2");
    private s_light = new Sprite("menus:instructions-2-light");
    
    constructor() {
        super();
        this.position.set(240, 0);
        this.addChild(this.s_light, this.s_text);

        this.disable();
    }

    reset() {
        this.enable();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                // animation decoration
                this.s_light.rotation += (1.5+Math.sin(m.time*1.5)*0.5)*m.delta;
                this.s_light.scale.x = F.scale(Math.cos(this.s_light.rotation*2), -1, 1, 0.6, 1);
                this.s_light.scale.y = F.scale(Math.cos((this.s_light.rotation*2)-Math.PI), -1, 1, 1, 1.4);

                break;
        }
    }

    private readonly startY = 400;
    private readonly endY = 297;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = F.scale(F.ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

export class SButtonBack extends SButtonConfigurable {
    constructor() {
        super({
            idle: "menus:button-back",
            pressed: "menus:button-back-p",
            x: 77,
            y: 323,
            clickHitboxProps: {offsetX: -64, offsetY: -21, width: 129, height: 43},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                messages.broadcast(Msg.HIDE_INSTRUCTIONS);
                messages.broadcast(Msg.SHOW_MENU2);
            }
        });

        this.disable();
    }

    reset() {
        this.enable();
    }

    private readonly startY = 390;
    private readonly endY = 323;
    animMoveInTick(t: number) {
        if (this.enabled) {
            this.y = F.scale(F.ease(t, "quadOut"), 0, 1, this.startY, this.endY);
        }
    }
}

// game
export class SGameBackgroundDecoration extends TopSprite {
    constructor() {
        super("background_decoration-f1");
        this.anchor.set(0, 0);

        this.new = false;
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.NEXT_QUESTION:
                this.visible = (g.CORRECT_ANSWERS[g.question]!==undefined);
                if (this.visible) {
                    // set position mode by the question whether it has an illustration
                    this.changeTextureKeyTick(
                        (g.ILLUSTRATION_QUESTIONS.indexOf(g.question)!==-1)
                        ? "background_decoration-f2"
                        : "background_decoration-f1"
                    );
                }
                break;
        }
    }
}
export class SButtonChoice extends SButtonConfigurable {
    constructor(private readonly id: number) {
        super({
            idle: "button-choice",
            pressed: "button-choice-p",
            x: 0, y: 0,
            clickProcessMessage: Msg.TICK_GAME_CLICK
        });

        this.clickAction = this.clickActionF;
        this.new = false;
    }

    messageStep(message: Msg) {
        super.messageStep(message);
        switch (message) {
            case Msg.NEXT_QUESTION:
                this.pressed = false;
                this.changeTextureKeyTick(this.textureKeys.idle);
                this.visible = (g.CORRECT_ANSWERS[g.question]!==undefined);
                this.clickable = this.visible;
                if (this.visible) {

                    // set position mode by the question whether it has an illustration
                    if ((g.ILLUSTRATION_QUESTIONS.indexOf(g.question)!==-1)) {
                        const x = 126;
                        const y = (this.id * 60) + 103;
                        this.position.set(x, y);
                    }
                    else {
                        const x = (this.id % 2 == 0) ? (126) : (354);
                        const y = (Math.floor(this.id / 2) == 0) ? (201) : (271);
                        this.position.set(x, y);
                    }
                }
                break;
        }
    }

    private clickActionF() {
        if (g.question === 56 && (this.id === 0 || this.id === 1)) {
            s.q56_controller.children[0].requestCamera();
        }
        else {
            if (g.CORRECT_ANSWERS[g.question] === this.id+1) {
                s.main.nextQuestion();
            }
            else {
                s.main.loseLife();
            }
        }
    }
}

export class SButtonNext extends SButtonConfigurable {
    constructor() {
        super({
            idle: "button-next",
            pressed: "button-next-p",
            x: 400, y: 330,
            clickProcessMessage: Msg.TICK_GAME_CLICK,
            clickHitboxProps: gatheredAssets.masks["button-next"]
        });

        this.clickAction = this.clickActionF;
        this.new = false;
        
    }

    enable() {
        super.enable();
        this.pressed = false;
        this.changeTextureKeyTick(this.textureKeys.idle);
    }

    private checkQ53() {
        if (s.q53_controller.children[0].checkAnswer()) {
            s.main.nextQuestion();
        }
        else {
            s.main.loseLife();
        }
    }

    private clickActionF() {
        // check
        switch (g.question) {
            case 49:
                SSchoolbag.animFinish.start();
                break;
            case 53:
                this.checkQ53();
                break;
            case 68:
                s.q68_controller.children[0].check();
                break;
        }
    }
}

export class SLivesText extends TopSprite {
    constructor() {
        super("lives-text");
        this.position.set(95, 333);
    }
}
export class SLivesNumber extends TopSprite {

    animLifeLost = new AnimationSequence()
        .createState({
            duration: 0.15,
            onTick: (t)=>{
                this.scale.x = F.scale(F.ease(t.percent, "sineOut"), 0, 1, 1, 3.5);
            }
        })
        .createState({
            offset: 0.15,
            duration: 0.35,
            onTick: (t)=>{
                this.scale.x = F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 3.5, 1);
            }
        })
        
        .createState({
            duration: 0.2,
            onTick: (t)=>{
                this.scale.y = F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 1, 3);
            }
        })
        .createState({
            offset: 0.2,
            duration: 0.3,
            onTick: (t)=>{
                this.scale.y = F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 3, 1);
            }
        });
        

    constructor() {
        super();
        this.position.set(201, 336);
        this.new = false;
    }

    effectLifeLost() {
        this.changeTextureKey(`lives-${g.lives}`);
        this.animLifeLost.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.START_GAME:
                this.changeTextureKey(`lives-${g.lives}`);
                break;

            case Msg.TICK:
                this.animLifeLost.simulateTick();
                break;
        }
    }
}

export class SQuestionText extends TopSprite {
    constructor() {
        super();
        this.anchor.set(0, 0);
        this.position.set(0, 0);
        this.new = false;

        // DEBUG
        this.visible = false;
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.NEXT_QUESTION:
                this.changeTextureKey(`question-${g.question}`);
                if (gatheredAssets.textures[`question-${g.question}`]) {
                    this.visible = true;
                }
                else {
                    this.visible = false;
                }
                break;
        }
    }
}

export class SQuestionNumber extends TopContainer {
    s_circle = new Sprite("question_number-circle");
    s_number = new Sprite();
    constructor() {
        super();
        this.position.set(39, 39);
        this.new = false;

        this.addChild(this.s_circle, this.s_number);
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.NEXT_QUESTION:
                if (this.visible) {
                    this.s_number.changeTextureKey(`question_number-${g.question}`);
                }
                break;
        }
    }
}

export class SEffectSmudge extends TopContainer {
    animEffect = new AnimationSequence(()=>{
        this.g_smudge.tint = "#6b00a6";
        this.g_smudge.scale.set(0);
    })
        .createState({
            duration: 0.6,
            onTick: (t)=>{
                this.g_smudge.scale.set(F.ease(t.percent, "sineOut") * 1.75);
            }
        })
        
        .createState({
            offset: 0.3,
            duration: 0.7,
            onTick: (t)=>{
                this.g_smudge.tint = C.getColorFromGradient(["#6b00a6", "#3e0066"], F.ease(t.percent, "sineInOut"));

                if (t.time >= 0.2) {
                    s.game_over_poster.animEffect.startOnce();
                }
            }
        })
        .createState({
            offset: 0.3 + 0.7,
            duration: 0.5,
            onTick: (t)=>{
                if (t.time >= 0.5) {
                    s.button_play_again.animEffect.startOnce();
                }
            }
        });

    g_smudge = new PIXI.Graphics().svg(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   version="1.1"
   width="480"
   height="360"
   viewBox="0 0 480 360"
   id="svg10"
   xml:space="preserve"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:cc="http://creativecommons.org/ns#"><defs
     id="defs10" /><g
     id="layer12"
     style="display:inline;opacity:1"><g
       id="g211"
       style="display:inline;fill:#ffffff"><path
         id="rect1"
         style="display:inline;fill:#ffffff;fill-opacity:1;stroke-width:3.17665;stroke-linecap:round"
         d="m 0,127.99243 c 0,0 51.008754,-81.567 86.503326,-81.09687 13.633674,0.23506 -20.450515,114.946 23.741404,97.78637 37.37508,-14.57393 91.67472,-120.58752 127.16929,-119.17714 64.64244,2.5857 -39.25558,66.52294 31.4985,77.80599 33.84913,5.40645 112.59536,-84.1527 159.60804,-50.06851 73.57484,53.12433 64.17231,129.51993 -2.11557,115.88626 -49.83344,-10.10773 -105.07333,3.52595 -115.18106,26.09203 -10.34279,22.80115 9.87266,84.38776 61.11648,75.45535 60.41129,-10.34279 63.70218,-17.62975 70.98915,36.19976 C 442.85943,339.54949 416.0622,360 416.0622,360 H 0 Z" /></g></g></svg>
<!--rotationCenter:319.99999999999955:180-->

`);
    g_mask = new PIXI.Graphics().rect(0, 0, settings.SCREEN_WIDTH, settings.SCREEN_HEIGHT).fill("#ffffff");

    constructor() {
        super();
        this.disable();
    }

    reset() {
        this.enable();

        this.g_smudge.pivot.set(0, settings.SCREEN_HEIGHT);
        this.g_smudge.position.set(0, settings.SCREEN_HEIGHT);
        
        this.g_smudge.mask = this.g_mask;
        this.addChild(this.g_smudge, this.g_mask);

        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch(message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}


export class SGameOverPoster extends TopContainer {
    animEffect = new AnimationSequence()
        .createState({
            duration: 0.8,
            onStart: (t)=>{
                this.s_light.visible = true;
            },
            onTick: (t)=>{
                const v = F.scale(F.ease(t.percent, "sineOut"), 0, 1, 0, 1);
                this.s_light.scale.set(v);
                this.s_light.alpha = v;
            }
        })

        .createState({
            offset: 0.5,
            duration: 0.4,
            onStart: (t)=>{
                this.s_text.visible = true;
            },
            onTick: (t)=>{
                this.s_text.scale.set(F.scale(F.ease(t.percent, "sineOut"), 0, 1, 0, 1.25));
            }
        })
        .createState({
            offset: 0.5+0.4,
            duration: 0.4,
            onTick: (t)=>{
                this.s_text.scale.set(F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 1.25, 1));
            }
        });

    s_text = new Sprite("menus:game_over");
    s_light = new Sprite("menus:game_over-light");
    
    constructor() {
        super();
        this.position.set(240, 96);
        this.addChild(this.s_light, this.s_text);

        this.disable();
    }

    reset() {
        this.enable();
        this.s_text.visible = false;
        this.s_light.visible = false;
        this.animEffect.canStart = true;
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                this.animEffect.simulateTick();
                break;
        }
    }
}

export class SButtonPlayAgain extends SButtonConfigurable {

    private scaleH = 0;

    animEffect = new AnimationSequence()
        .createState({
            duration: 0.4,
            onStart: ()=>{
                this.visible = true;
                this.scale.set(0);
            },
            onTick: (t)=>{
                this.scale.set(F.scale(F.ease(t.percent, "sineOut"), 0, 1, 0, 1.25));
            },
            onFinish: ()=>{
                s.main.menuIsClickable = true;
            }
        })
        .createState({
            offset: 0.4,
            duration: 0.4,
            onTick: (t)=>{
                this.scale.set(F.scale(F.ease(t.percent, "sineInOut"), 0, 1, 1.25, 1));
            }
        })

    animEffect2 = new AnimationSequence(()=>{
        this.scaleH = this.scale.x; // retrieve the scale transformation
    })
        .createState({
            duration: 0.4,
            onTick: (t)=>{
                this.scale.set(F.scale(F.ease(t.percent, "sineIn"), 0, 1, this.scaleH, 0));
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super({
            idle: "menus:button-play_again",
            pressed: "menus:button-play_again-p",
            x: 240,
            y: 320,
            clickHitboxProps: {offsetX: -147, offsetY: -24, width: 294, height: 47},
            clickProcessMessage: Msg.TICK_MENU_CLICK,
            clickAction: ()=>{
                messages.broadcast(Msg.PLAY_AGAIN_CLICKED);
            }
        });
        this.disable();
    }

    reset() {
        this.enable();
        this.visible = false;
        this.animEffect.canStart = true;

        s.main.menuIsClickable = false;
    }

    messageStep(message: Msg) {
        super.messageStep(message);
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                this.animEffect.simulateTick();
                this.animEffect2.simulateTick();
                break;
        }
    }
}

export class SBomb extends TopContainer {
    s_bomb = new Sprite();
    s_time = new Sprite();
    timeLeft = 0;
    timeLeftIH = 0;

    constructor() {
        super();
        this.s_bomb.pivot.set(-6, 6);

        this.position.set(440, 40);

        this.addChild(this.s_bomb, this.s_time);
    }

    begin(seconds: number) {
        s.main.gameTick = true;
        this.timeLeft = seconds;
        this.timeLeftIH = seconds;
        if (this.timeLeftIH > 0) {
            this.visible = true;
            this.emitClockTick();
        }
        else {
            this.visible = false;
        }
            
    }
    emitClockTick() {
        // a second has passed
        this.s_time.changeTextureKey(`time_bomb-${this.timeLeftIH}`);
        if (this.timeLeftIH > 0) {
            if (this.timeLeftIH > 3) {
                soundManager.produce("tick");
            }
            else {
                soundManager.produce("beep");
            }

            if (this.timeLeftIH > 5) {
                this.s_time.tint = "#ffffff";
            }
            else if (this.timeLeftIH > 3) {
                this.s_time.tint = "#ffee00";
            }
        }
        else {
            if (s.main.gameTick) {
                s.main.explode();
            }
        }
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                // animation decoration
                if (this.visible) {
                    this.s_bomb.changeTextureKeyTick(`bomb-f${ Math.floor(m.time*6)%4+1 }`);
                    this.s_bomb.scale.set( Math.sin(m.time*2.5)*0.065+1 );
                }
                break;

            case Msg.TICK_GAME_BOMB:
                if (this.visible) {
                    this.timeLeft -= m.delta;

                    // flash
                    if (this.timeLeftIH <= 3) {
                        const pulse = (this.timeLeftIH === 1) ? 30 : 15;
                        this.s_time.tint = (Math.floor(this.timeLeft*pulse)%2 === 0) ? "#ffee00" : "#ff0000";
                    }

                    // timer
                    if (Math.ceil(this.timeLeft) < this.timeLeftIH) {
                        this.timeLeftIH = Math.ceil(this.timeLeft);
                        this.emitClockTick();
                    }
                }
                break;
        }
    }
}

export class SEffectExplosion extends TopContainer {
    gameOverCalled = false;
    animEffect = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.g_explosion.scale.set(F.ease(t.percent, "sineOut")*10);
                
                if (t.time >= 0.4 && !this.gameOverCalled) {
                    s.main.gameOver(true);
                    this.gameOverCalled = true;
                }
            }
        });

    g_explosion = new PIXI.Graphics()
        .svg(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg
        version="1.1"
        width="128.25"
        height="121.5"
        viewBox="0 0 128.25 121.5"
        id="svg10"
        xml:space="preserve"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:svg="http://www.w3.org/2000/svg"
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xmlns:cc="http://creativecommons.org/ns#"><defs
            id="defs10" /><g
            id="layer12"
            style="display:inline;opacity:1"><g
            id="g210"
            style="display:inline"><g
                id="g195"
                style="display:inline;fill:#ff903e;fill-opacity:1"><path
                style="fill:#ff903e;fill-opacity:1;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"
                d="M 424.5,43 426,15.5 443.5,39 452,13 l 8.5,33.25 33.5,-22.5 -18.75,29 29.5,-1.25 -28.9186,16.582117 27.42185,16.422496 L 473.75,81.25 499,100 469.52037,93.334124 485.28768,127.45846 461,101.25 l -13.5,32.25 -5.75,-35.25 -13.5,36.25 -1,-36 -36.5,22.75 L 415,84.5 376.5,67 415,61.75 l -28,-35 z"
                id="path179" /><path
                style="fill:#ffd561;fill-opacity:1;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"
                d="m 432,52 -1.75,-24.25 14.5,28 6.75,-24.5 7,23 L 479,37.5 465.75,59.5 493.5,55.75 472.29754,67.078729 487.53108,79.386486 466.5,79 489,95.25 463.98371,88.279173 473.99904,111.10739 458,94.75 l -8.75,27 L 443,92.25 432,115 433,91.25 404.75,108.5 426,80.5 395,69.5 422.25,62.5 403,37.75 Z"
                id="path209" /><path
                style="fill:#fff9cf;fill-opacity:1;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"
                d="m 433.75,58 -0.25,-17.75 11.75,20.25 6.5,-18.5 3.5,19.5 15.75,-15 -8.25,16.5 15.5,-3.25 -15.20246,11.078729 17.73354,6.307757 L 464,79 480,91 459.98371,84.029173 467.49904,102.35739 455,88.25 l -4.5,21.5 -4.75,-23.5 -10.75,15.5 V 85.25 L 419.75,94.5 432.5,78.25 408.25,70.75 433,67.5 419.75,50.25 Z"
                id="path210" /></g></g></g></svg>
        `);

    g_mask = new PIXI.Graphics().rect(0, 0, settings.SCREEN_WIDTH, settings.SCREEN_HEIGHT).fill("#ffffff");

    constructor() {
        super();
        this.disable();
    }

    reset() {
        this.gameOverCalled = false;

        this.enable();

        this.g_explosion.pivot.set(440+5, 40+25);
        this.g_explosion.position.set(440, 40);

        this.g_explosion.mask = this.g_mask;
        this.addChild(this.g_explosion, this.g_mask);

        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch(message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

export class SEffectPaint extends TopContainer {
    private s_paint = new Sprite("effect-paint");
    private g_fill = new PIXI.Graphics().rect(-480, 0, 480+1, 360).fill("#ffffff");

    private readonly startX = -274;
    private readonly endX = 480;

    private animEffect = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.x = F.scale(F.ease(t.percent, "quadOut"), 0, 1, this.startX, this.endX);
            }
        });
    
    constructor() {
        super();
        this.s_paint.anchor.set(0, 0);

        this.position.set(0, 0);
        
        this.addChild(this.g_fill, this.s_paint);

        this.disable();
    }

    /** play the effect */
    animPlay() {
        this.enable();
        this.animEffect.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

export class SGameCompletePoster extends TopSprite {
    animAppear = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.alpha = t.percent;
            }
        })
    
    constructor() {
        super("menus:game_complete_poster");
        this.anchor.set(0, 0);

        soundManager.produce("game_complete");
        this.animAppear.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_MENU_LOGIC:
                this.animAppear.simulateTick();
                break;
        }
    }
}

export class SSpriteImage extends TopSprite {
    constructor(textureKey: string, p: {
        x: number,
        y: number,
        tint?: PIXI.ColorSource,
        scale?: number
    }) {
        super(textureKey);
        this.position.set(p.x, p.y);

        if (p.tint) this.tint = p.tint;
        if (p.scale) this.scale.set(p.scale);
    }
}
