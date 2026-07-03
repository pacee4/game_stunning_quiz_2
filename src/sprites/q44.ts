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


// QUESTION 44
export class SBeginText extends TopSprite {
    constructor() {
        super("44:begin_text");
        this.anchor.set(0, 0);
    }

    static showMaze() {
        s.q44_begin_text.children[0].visible = false;
        s.q44_begin_point.children[0].visible = false;
        s.q44_maze.children[0].visible = true;
        s.q44_maze_text.children[0].animDisappear.stop();
        s.q44_maze_text.children[0].alpha = 1;
        s.q44_maze_text.children[0].visible = true;
        s.q44_maze_text.children[0].animDisappear.canStart = true;
    }
    static hideMaze() {
        s.q44_maze.children[0].visible = false;
        if (g.lives !== 0) {
            s.q44_begin_text.children[0].visible = true;
            s.q44_begin_point.children[0].visible = true;
            if (s.q44_maze_text.children[0].visible) {
                s.q44_maze_text.children[0].animDisappear.startOnce();
            }
        }
    }
}
export class SBeginPoint extends TopSprite {
    clickHitbox = new CompHitbox(this);

    constructor() {
        super("44:begin_point");
        this.position.set(248, 288);
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
                if (m.onePointerIsPressed() && this.clickHitbox.collidePointer(0)) {
                    SBeginText.showMaze();
                }
                break;
        }
    }
}
export class SMazeText extends TopSprite {
    animDisappear = new AnimationSequence()
        .createState({
            duration: 1,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
            },
            onFinish: ()=>{
                this.visible = false;
            }
        });

    constructor() {
        super("44:maze_text");
        this.anchor.set(0, 0);

        this.visible = false;
    }

    messageStep(message: Msg): void {
        switch(message) {
            case Msg.TICK_GAME_LOGIC:
                this.animDisappear.simulateTick();
                break;
        }
    }
}
export class SMaze extends TopContainer {
    private s_room = new Sprite("44:maze_room");
    private s_spinner = new Sprite("44:maze_spinner");
    private collision: CompMask;
    private collision_spinner: CompMask;
    
    constructor() {
        super();
        this.s_room.anchor.set(0, 0);

        this.collision = new CompMask(this, gatheredAssets.masks["44:maze_collision"]);
        this.collision_spinner = new CompMask(this.s_spinner, gatheredAssets.masks["44:maze_spinner_collision"]);
        this.collision_spinner.calculateOriginPoint();

        this.s_spinner.position.set(360, 156);

        this.addChild(this.s_spinner, this.s_room);
    }
    
    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                if (this.visible) {
                    // collision

                    const spinnerPos = F.rotatePoint(m.mouseX, m.mouseY, this.s_spinner.rotation, this.s_spinner.x, this.s_spinner.y);

                    // hide maze text
                    if (m.mouseY <= 191) {
                        s.q44_maze_text.children[0].animDisappear.startOnce();
                    }

                    // finish area
                    if (m.mouseY <= 30) {
                        s.main.nextQuestion();
                    }

                    // safe area
                    else if (
                        !(!m.isMobile || m.pointerIsDown(0)) && (m.mouseY >= 258)
                    ) {
                        SBeginText.hideMaze();
                    }

                    // dangerous area
                    else if (
                        !(!m.isMobile || m.pointerIsDown(0))
                        || this.collision.collidePoint(m.mouseX, m.mouseY)
                        || this.collision_spinner.collidePoint(spinnerPos.x, spinnerPos.y)
                    ) {
                        s.main.loseLife();
                        SBeginText.hideMaze();
                    }

                    // logic
                    this.s_spinner.rotation -= (3/Math.PI)*m.delta;
                }
                
                break;
        }
    }
}
