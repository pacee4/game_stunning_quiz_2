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

// QUESTION 68
export class SBackground extends TopContainer {
    private s_background = new Sprite("68:background");
    private s_exercise_book = new Sprite(F.isBetween(g.selectedSubject, 1, 2) ? "68:exercise_book-1" : "68:exercise_book-3");
    private s_bottom = new Sprite("68:bottom_cover");

    animGetExerciseBook = new AnimationSequence()
        .createState({
            duration: 0.6,
            onTick: (t)=>{
                this.s_exercise_book.y = F.scale(F.ease(t.percent, "quadOut"), 0, 1, 140, 0);
            }
        });
    
    constructor() {
        super();

        this.s_background.anchor.set(0, 0);
        this.s_exercise_book.anchor.set(0, 0);
        this.s_bottom.anchor.set(0, 0);

        this.addChild(this.s_background, this.s_exercise_book, this.s_bottom);

        this.animGetExerciseBook.start();
    }

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_LOGIC:
                this.animGetExerciseBook.simulateTick();
                break;
        }
    }
}
export class SController extends TopContainer {
    private readonly acceptableWord = ["глагол","повесть","уравнение","губернатор"][g.selectedSubject-1];
    
    private writtenWord = "";
    private nextCharacterX = 258;

    constructor() {
        super();
        console.log(this.acceptableWord);

        const keyLocations: ReadonlyArray<[number, number]> = [
            [153, 257],
            [323, 295],
            [115, 257],
            [259, 219],
            [343, 257],
            [183, 219],
            [381, 257],
            [373, 219],
            [209, 295],
            [31, 219],
            [145, 219],
            [305, 257],
            [171, 295],
            [221, 219],
            [267, 257],
            [191, 257],
            [229, 257],
            [133, 295],
            [247, 295],
            [107, 219],
            [39, 257],
            [411, 219],
            [69, 219],
            [95, 295],
            [297, 219],
            [335, 219],
            [449, 219],
            [77, 257],
            [285, 295],
            [419, 257],
            [361, 295],
            [57, 295]
        ];

        for (let i = 0; i < keyLocations.length; i++) {
            s.q68_key_buttons.addChild(new SKeyButtons(i, keyLocations[i][0], keyLocations[i][1]));
        }
    }

    writeLetter(letterID: number) {
        const s_character = new Sprite("letter-"+(letterID+1));
        s_character.anchor.set(0, 0);
        s_character.scale.set(0.8);

        if (this.nextCharacterX+s_character.width-2 <= 432) {
            s_character.position.set(this.nextCharacterX, 155);
            s_character.tint = "#0021df";
            s.misc.addChild(s_character as any);

            this.nextCharacterX += s_character.width-2;
            this.writtenWord += g.RUSSIAN_LETTERS[letterID];

            soundManager.produce("68:write");
        }
    }

    eraseLetters() {
        this.writtenWord = "";
        this.nextCharacterX = 258;
        s.misc.destroyChildren();
    }

    check() {
        if (this.writtenWord === this.acceptableWord) {
            s.main.nextQuestion();
        }
        else {
            
            s.main.loseLife();
            if (g.lives !== 0) {
                this.eraseLetters();
            }
        }
    }
}
export class SKeyButtons extends TopContainer {
    private s_letter;
    private s_key = new Sprite();
    private clickHitbox = new CompHitbox(this, {offsetX: -19, offsetY: -19, width: 38, height: 38});
    
    // multitouch support
    constructor(public readonly letterID: number, x: number, y: number) {
        super();
        this.s_letter = new Sprite(`letter-`+(letterID+1));
        this.s_letter.scale.set(2/3);
        this.s_letter.tint = "#e0f0ff";

        this.position.set(x, y);

        this.addChild(this.s_key, this.s_letter);

        this.s_key.changeTextureKey("68:keyboard_button");
    }

    private pressed = false;

    messageStep(message: Msg): void {
        switch (message) {
            case Msg.TICK_GAME_CLICK:
            
                if (m.pointerIsDown(0)) {
                    this.pressed = this.clickHitbox.collidePointer(0);
                }
                else {
                    if (this.pressed) {
                        this.clickAction();
                        this.pressed = false;
                    }
                }

                this.s_key.changeTextureKeyTick(this.pressed ? "68:keyboard_button-p" : "68:keyboard_button");
                break;
        }
    }

    private clickAction() {
        s.q68_controller.children[0].writeLetter(this.letterID);
    }
}
