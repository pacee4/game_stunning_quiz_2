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


// QUESTION 36
export class S36_Controller extends TopContainer {
    private animFinish = new AnimationSequence().createState({
        duration: 0.6,
        onFinish: ()=>{
            s.main.nextQuestion();
        }
    });

    static getX(side: "left"|"right") {
        return (side==="left") ? (130) : (350);
    }
    static getY(pos: number) {
        return 100+pos*60;
    }

    clickedElement: S36_Elements|null = null; // reference to an object
    activeLine: S36_Lines|null = null; // reference to an object
    private connectsMade = 0;
    connectingByHolding = false;

    constructor() {
        super();

        for (let side of ["left", "right"]) {
            const numbers = [0, 1, 2, 3];
            for (let i = 0; i < 4; i++) {
                s.q36_elements.addChild(new S36_Elements(
                    numbers.splice(F.randomNumber(0, numbers.length-1), 1)[0], 
                    i, (<any>side)
                ));
            }
        }
    }

    clickLogic(element: S36_Elements) {
        const prev = this.clickedElement;

        if (prev === element) {
            // discard
            this.discard(element);
        }
        else if (!prev || prev.side === element.side) {
            if (prev) {
                // delete old line
                prev.connecting = false;
                this.activeLine?.destroy();
            }
            // create a new line
            this.activeLine = new S36_Lines(
                S36_Controller.getX(element.side),
                S36_Controller.getY(element.pos)
            );
            s.q36_lines.addChild(this.activeLine);
            
            element.connecting = true;
            this.clickedElement = element;
        }
        else {
            // connect has made
            this.connect(prev, element);
        }
    }

    private connect(prev: S36_Elements, element: S36_Elements) {
        prev.connecting = false;
        element.connecting = false;
        
        let wrong = false;
        if (prev.id === element.id) {
            prev.connected = true;
            element.connected = true;
            
            this.connectsMade++;

            if (this.connectsMade === 4) {
                s.main.gameTick = false;
                this.animFinish.start();
            }
        }
        else {
            wrong = true;
            this.activeLine?.animRed.start();
            prev.animRed.start();
            element.animRed.start();
            s.main.loseLife();
        }

        this.activeLine?.attach(
            S36_Controller.getX(element.side),
            S36_Controller.getY(element.pos),
            wrong
        );

        this.clickedElement = null;
    }
    private discard(prev: S36_Elements) {
        prev.connecting = false;
        this.activeLine?.destroy();
        this.clickedElement = null;
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                if (this.connectingByHolding) {
                    if (!m.pointerIsDown(0)) {
                        // find the element that touches mouse
                        this.connectingByHolding = false;
                        if (this.clickedElement) {
                            const secondElement = s.q36_elements.children.find((element)=>(
                                element.clickHitbox.collidePoint(m.mouseX, m.mouseY) && element.side !== this.clickedElement?.side
                            ));

                            if (secondElement) {
                                // connect
                                this.connect(this.clickedElement, secondElement);
                            }
                            else {
                                // discard
                                this.discard(this.clickedElement);
                            }
                        }
                    }
                }
                this.animFinish.simulateTick();
                break;
        }
    }
}

export class S36_Elements extends TopContainer {
    private s_base = new Sprite("36:element-base");
    private readonly s_outline = new Sprite("36:element-outline");
    private readonly s_emoji = new Sprite();

    clickHitbox = new CompHitbox(this, {offsetX: -25, offsetY: -25, width: 50, height: 50});
    pressed = false;
    focused = false;
    connecting = false;
    connected = false;

    private tintColorHolder = "#ffffff";
    animRed = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.s_base.tint = C.getColorFromGradient(["#ff0000", "#ffffff"], t.percent);
            }
        });

    // the first element can connect to the second one

    constructor(public id: number, public pos: number, public side: "left"|"right") {
        super();
        this.s_emoji.scale.set(0.3);
        this.s_emoji.changeTextureKey( "36:" 
            + String(id+1) 
            + (side==="left" ? "a" : "b")
        );

        this.position.set(S36_Controller.getX(side), S36_Controller.getY(pos));

        this.addChild(this.s_base, this.s_emoji, this.s_outline);
    }

    tickClick() {
        if (m.onePointerIsPressed() && this.clickHitbox.collidePointer(0)) {
            this.animRed.playing = false;
            this.pressed = true;
        }
        if (this.pressed) {
            if (!m.pointerIsDown(0)) {
                if (this.focused) {
                    s.q36_controller.children[0].clickLogic(this);
                }
                this.pressed = false;
                return;
            }

            this.focused = this.clickHitbox.collidePointer(0);

            if (!this.focused && !s.q36_controller.children[0].clickedElement) {
                this.pressed = false;
                s.q36_controller.children[0].connectingByHolding = true;
                s.q36_controller.children[0].clickLogic(this);
            }
        }
    }

    messageStep(message: Msg): void {
        switch(message) {
            case Msg.TICK_GAME_CLICK:
                if (!this.connected) {
                    this.tickClick();
                }

                const tintColor = (
                    (this.connecting) ? (
                        (this.pressed) ? "#008000" : "#00ff00"
                    )
                    : (
                        (this.pressed) ? "#808080" : "#ffffff"
                    )
                );
                if (tintColor !== this.tintColorHolder) {
                    this.tintColorHolder = tintColor;
                    this.s_base.tint = tintColor;
                }

                this.animRed.simulateTick();
                break;

        }
    }
}

export class S36_Lines extends TopContainer {
    connected = false;

    g_line = new PIXI.Graphics();

    animRed = new AnimationSequence()
        .createState({
            duration: 0.8,
            onTick: (t)=>{
                this.alpha = 1-t.percent;
            },
            onFinish: ()=>{
                this.destroy();
            }
        });

    constructor(public startX: number, public startY: number) {
        super();
        this.addChild(this.g_line);
    }

    private drawLineTo(x: number, y: number, red=false) {
        this.g_line.clear();
        this.g_line
            .moveTo(this.startX, this.startY)
            .lineTo(x, y)
            .stroke({
                width: 6, 
                color: ((red) ? "#ff0000" : "#000000"),
                cap: "round"
            });
    }

    attach(x: number, y: number, wrong=false) {
        this.drawLineTo(x, y, wrong);
        this.connected = true;
        if (wrong) {
            this.animRed.start();
        }
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK:
                if (!this.connected) {
                    this.drawLineTo(m.mouseX, m.mouseY);
                }
                this.animRed.simulateTick();
                break;
        }
    }
}