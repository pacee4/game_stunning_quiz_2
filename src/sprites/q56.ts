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


// QUESTION 56
export class SController extends TopContainer {
    videoSource = false;

    constructor() {
        super();
    }

    requestCamera() {
        // if there is no video source, create one
        if (!this.videoSource) {
            s.main.gameTick = false;

            navigator.mediaDevices.getUserMedia({video: {
                facingMode: "user", 
                aspectRatio: {ideal: 4/3},
                width: {max: 1440},
                height: {max: 1080}
            }})
                .then((stream)=>{
                    const video = new SBackground(stream);
                    s.q56_background.addOneChild(video);
                    this.videoSource = true;
                    return video.play();
                })
                .then(()=>{
                    s.q56_question_text.removeChildAt(0).destroy();
                    s.main.gameTick = true;
                })
                .catch(()=>{
                    s.main.gameTick = true;
                    s.main.loseLife();
                });
        }
        
        else {
            s.main.loseLife();
        }
}
}

export class SQuestionText extends TopSprite {
    constructor() {
        super("question-56-q");
        this.anchor.set(0, 0);
        this.position.set(0, 0);
    }
}

export class SBackground extends TopContainer {
    elVideo = document.createElement("video");

    constructor(stream: MediaStream) {
        super();

        this.elVideo.muted = true;
        this.elVideo.srcObject = stream;
    }

    async play() {
        await this.elVideo.play();
        
        const s_videoSource = new PIXI.VideoSource({resource: this.elVideo});
        const s_texture = new PIXI.Texture({source: s_videoSource});
        const s_sprite = new PIXI.Sprite(s_texture);
        this.addChild(s_sprite);

        s_sprite.scale.set(settings.SCREEN_HEIGHT/s_sprite.height);
        s_sprite.anchor.set(0.5);
        s_sprite.position.set(settings.SCREEN_WIDTH/2, settings.SCREEN_HEIGHT/2);
    }

    messageStep(message: Msg) {
        switch (message) {
            case Msg.TICK:
                break;
            case Msg.SHOW_GAME_OVER:
                // destroy the video source as well
                this.destroy(true);
                break;
        }
    }
}
