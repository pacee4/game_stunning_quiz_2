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


// QUESTION 40
export class SController extends TopContainer {
    currentColorId = 0;
    playing = false;
    correctAnswers = 0;
    private animFinish = new AnimationSequence().createState({
        duration: 0.6,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });

    constructor() {
        super();

        s.q40_background_cover.instantiateOne();
        s.q40_screen.instantiateOne();
        s.q40_screen_flash.instantiateOne();
        for (let i = 0; i < 8; i++) {
            s.q40_buttons.addChild(new SButtons(i));
        }

        s.q40_string.instantiateOne();
        s.q40_tip.instantiateOne();
        s.q40_red_frame.instantiateOne();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                if (this.playing) {
                    s.q40_buttons.children.forEach((e)=>{e.cGameTick();});
                    s.q40_string.children[0].cGameTick();
                }
                this.animFinish.simulateTick();
                break;
        }
    }

    startGame() {
        this.playing = true;
        s.q40_string.children[0].visible = true;
        this.runString();
    }
    endGame() {
        this.playing = false;
        s.q40_string.children[0].visible = false;
    }
    runString() {
        if (this.correctAnswers < 10) {
            this.currentColorId = F.randomNumber(0, 7);
            s.q40_string.children[0].runString(this.currentColorId);
            s.main.invulnerability = 0.3;
        }
        else {
            this.endGame();
            this.animFinish.start();
        }
    }

    correctAnswer() {
        this.correctAnswers++;

        soundManager.produce("40:correct");
        this.runString();
    }
    wrongAnswer() {
        s.q40_buttons.children.forEach((e)=>{e.pressed = false;});
        s.q40_red_frame.children[0].beginAnim();
        
        s.main.loseLife();
        if (g.lives === 0) {
            this.endGame();
        }
        else {
            this.runString();
        }
    }
}

export class SBackgroundCover extends TopSprite {
    constructor() {
        super("40:background");
        this.anchor.set(0, 0);
    }
}

export class SScreen extends TopSprite {
    constructor() {
        super("40:screen");
        this.anchor.set(0, 0);
        this.position.set(30, 20);
    }
}

export class SScreenFlash extends TopSprite {

    private animEffect = new AnimationSequence()
        .createState({
            duration: 0.6,
            onStart: ()=>{
                this.visible = true;
            },
            onTick: (t)=>{
                this.alpha = (1-t.percent);
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super();
        this.anchor.set(0, 0);
        this.position.set(30, 20);

        this.visible = false;
    }

    beginAnim(colorId: number) {
        this.changeTextureKey(`40:${SButtons.COLOR_NAMES[colorId]}_flash`);
        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

export class SRedFrame extends TopSprite {
    private animEffect = new AnimationSequence(()=>{
        this.visible = true;
    })
        .createState({
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = t.percent;
            }
        })
        .createState({
            offset: 0.3,
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = (1-t.percent);
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super("40:red_frame");
        this.anchor.set(0, 0);
        this.position.set(0, 0);

        this.visible = false;
    }

    beginAnim() {
        this.animEffect.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.animEffect.simulateTick();
                break;
        }
    }
}

export class SButtons extends TopSprite {
    static readonly COLOR_NAMES: ReadonlyArray<string> = [
        "red", "orange", "yellow", "green", "light_blue", "blue", "purple", "white"
    ];
    static readonly COLOR_CODES: ReadonlyArray<string> = [
        "#E93A3A", "#FA8C18", "#FCEF29", "#32B000", "#39AEF4", "#202DD9", "#AB41EF", "#F0F0F0"
    ]

    clickHitbox: CompHitbox;
    pressed = false;
    focused = false;
    
    constructor(public colorId: number) {
        super(`40:${SButtons.COLOR_NAMES[colorId]}`);

        this.position.set(58+colorId*52, 280);
        this.clickHitbox = new CompHitbox(this);
    }

    cGameTick() {
        if (s.main.canClick) {
            if (m.onePointerIsPressed() && this.clickHitbox.collidePointer(0)) {
                this.pressed = true;
            }
            if (this.pressed) {
                if (!m.pointerIsDown(0)) {
                    if (this.focused) {
                        this.clickAction();
                    }
                    this.pressed = false;
                }

                this.focused = this.clickHitbox.collidePointer(0);
            }

            this.tint = (this.pressed && this.focused) ? "#808080" : "#ffffff";
        }
    }

    private clickAction() {
        s.q40_screen_flash.children[0].beginAnim(this.colorId);
        if (this.colorId === s.q40_controller.children[0].currentColorId) {
            s.q40_controller.children[0].correctAnswer();
        }
        else {
            s.q40_controller.children[0].wrongAnswer();
        }
    }
}

export class SString extends TopSprite {
    readonly LEFT_CORNER = 33;
    readonly RIGHT_CORNER = 447;
    leftCorner = 0;
    rightCorner = 0;
    time = 0;
    duration = 3;

    constructor() {
        super();
        this.visible = false;
    }

    runString(colorId: number) {
        this.changeTextureKey(`40:string-${colorId}`);

        this.leftCorner = this.LEFT_CORNER-(this.width/2);
        this.rightCorner = this.RIGHT_CORNER+(this.width/2);

        this.position.set(this.rightCorner, F.randomNumber(55, 215));

        this.tint = SButtons.COLOR_CODES[F.randomNumber(0, 7)];

        this.time = 0;
    }

    cGameTick() {
        this.time += m.delta;
        this.x = F.scale(this.time, 0, this.duration, this.rightCorner, this.leftCorner);
        if (this.time > this.duration) {
            s.q40_controller.children[0].wrongAnswer();
        }
    }
}

export class SFadeTip extends TopSprite {
    blurFilter = new PIXI.BlurFilter();

    anim = new AnimationSequence(()=>{
        this.alpha = 0;
        this.blurFilter.strengthX = 0;
        this.blurFilter.strengthY = 30;
        this.blurFilter.resolution = dp;
    })
        .createState({
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = t.percent;
                this.blurFilter.strengthY = (1-t.percent)*30;
            },
        })
        .createState({
            offset: 0.3+2.4,
            duration: 0.3,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
                this.blurFilter.strengthY = t.percent*30;
            },
            onFinish: ()=>{
                s.q40_controller.children[0].startGame();
                soundManager.produce("40:start_game");
                this.destroy();
            }
        });

    constructor() {
        super("40:tip");
        this.position.set(240, 135);

        this.filters = [this.blurFilter];

        this.anim.start();
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                this.anim.simulateTick();
                break;
        }
    }
}
