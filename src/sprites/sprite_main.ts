import * as PIXI from "pixi.js";
import * as F from "@/core/functions";
import { Msg, settings } from "@/editable";
import { dp, m, messages, layers } from "@/core/sensing_properties";
import { Sprite, TopSprite, TopContainer, CompHitbox, CompMask, CompGroup } from "@/core/core";

import { AnimationSequence } from "@/custom";
import * as C from "@/custom";
import { soundManager } from "@/core/sound_manager";
import { gatheredAssets } from "@/core/asset_loader";
import { g } from "./global_properties";
import { s } from "./storage";


import * as Q44 from "./q44";
import * as Q49 from "./q49";
import * as Q65 from "./q65";
import { SButtonChoice, SButtonConfigurable, SSpriteImage } from "./sprites";


export class Main extends TopContainer {

    invulnerability = 0;
    isGame = false;
    gameTick = false;
    readonly fLoseLife = ()=>{this.loseLife()};
    readonly fNextQuestion = ()=>{this.nextQuestion();}
    
    get canClick() {return (this.invulnerability <= 0 && this.gameTick);}

    menuIsClickable = true;

    // animations
    animMoveIn = new AnimationSequence(()=>{
        this.menuIsClickable = false;
    })
        .createState({
            duration: 1.6,
            onTick: (t)=>{
                s.title.children[0].animMoveInTick(t.percent);
                s.button_play_part_link.children[0].animMoveInTick(t.percent);
                s.button_play.children[0].animMoveInTick(t.percent);
                s.button_how_to_play.children[0].animMoveInTick(t.percent);
                s.instruction_poster1.children[0].animMoveInTick(t.percent);
                s.instruction_poster2.children[0].animMoveInTick(t.percent);
                s.button_back.children[0].animMoveInTick(t.percent);

                if (t.percent >= 1) {
                    this.menuIsClickable = true;
                }
            }
        });


    private animPlayClicked = new AnimationSequence(()=>{
        layers[0].attach(s.title.children[0]);

        s.title.children[0].anim.e2P.start();
        s.effect_plain_cover.animPlay();
    })
        .createState({
            duration: 1,
            onFinish: ()=>{
                s.effect_paint.animPlay();
            }
        })
        .createState({
            offset: 1,
            duration: 1,
            onFinish: ()=>{
                messages.broadcast(Msg.INIT_GAME);
                s.effect_plain_cover.animEffect2.start();
            }
        });
    

    private animPlayAgainClicked = new AnimationSequence(()=>{
        s.effect_paint.animPlay();
        s.button_play_again.animEffect2.start();
    })
        .createState({
            duration: 0.8,
            onFinish: ()=>{
                messages.broadcast(Msg.START_GAME);
            }
        })

    // commands
    public loseLife() {
        if (this.canClick) {
            g.lives--;
            if (g.lives === 0) {
                this.gameOver();
            }
            else {
                this.invulnerability = 0.3;
                this.effectLifeLost();
            }
        }
    }

    public effectLifeLost() {
        soundManager.produce("pew");
        s.lives_number.children[0].effectLifeLost();
    }

    public gameOver(noSound=false) {
        this.isGame = false;
        if (!noSound) { 
            messages.broadcast(Msg.SHOW_GAME_OVER);
            soundManager.produce("game_over");
        }
        s.effect_smudge.reset();
        s.game_over_poster.reset();
        s.button_play_again.reset();
    }

    public explode() {
        if (this.isGame && this.gameTick) {
            this.isGame = false;
            messages.broadcast(Msg.SHOW_GAME_OVER);

            soundManager.produce("explosion");
            s.effect_explosion.reset();
        }
    }

    public nextQuestion() {
        this.gameTick = false;
        if (g.question < 70) {
            messages.broadcast(Msg.NEXT_QUESTION);
        }
        else {
            Main.clearQuestionFunctions[70]();
            messages.broadcast(Msg.GAME_COMPLETE);
        }
    }


    static readonly startQuestionFunctions: {[index: number]: ()=>void} = {
        36: ()=>{
            s.q36_controller.instantiateOne();
        },
        37: ()=>{
            s.misc.addChild(
                new SButtonConfigurable(
                    {
                        idle: "37:drum",
                        x: 97, y: 156, clickHitboxProps: gatheredAssets.masks["37:drum"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fNextQuestion
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:cymbal",
                        x: 254, y: 155, clickHitboxProps: gatheredAssets.masks["37:cymbal"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:guitar",
                        x: 401, y: 143, clickHitboxProps: gatheredAssets.masks["37:guitar"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:trumpet",
                        x: 162, y: 248, clickHitboxProps: gatheredAssets.masks["37:trumpet"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                ),
                new SButtonConfigurable(
                    {
                        idle: "37:triangle",
                        x: 324, y: 242, clickHitboxProps: gatheredAssets.masks["37:triangle"],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: s.main.fLoseLife
                    }
                )
            );
        },
        40: ()=>{
            s.q40_controller.instantiateOne();
        },
        44: ()=>{
            s.q44_begin_text.instantiateOne();
            s.q44_begin_point.instantiateOne();
            s.q44_maze.instantiateOne();
            s.q44_maze_text.instantiateOne();

            Q44.SBeginText.hideMaze();
        },
        45: ()=>{
            s.q45_controller.instantiateOne();
        },
        48: ()=>{
            const columnsX = [151, 329];
            const rowsY = [159, 213, 267];
            const rowsTextures = ["48:green_paint_bucket", "48:gray_paint_bucket", "48:brown_paint_bucket"]
            for (let row = 0; row < rowsY.length; row++) {
                for (let col = 0; col < columnsX.length; col++) {
                    s.misc.addChild(new SButtonConfigurable({idle: "48:button", 
                        x: columnsX[col], y: rowsY[row],
                        clickProcessMessage: Msg.TICK_GAME_CLICK,
                        clickAction: (row===0 && col===1) ? s.main.fNextQuestion : s.main.fLoseLife
                    }));

                    if (col===0) {
                        s.misc.addChild(new SSpriteImage(rowsTextures[row],
                        {x: columnsX[col], y: rowsY[row]}));
                    }
                    else {
                        s.misc.addChild(new SSpriteImage(rowsTextures[row],
                        {x: columnsX[col]-20, y: rowsY[row]}));
                        s.misc.addChild(new SSpriteImage(rowsTextures[row],
                        {x: columnsX[col]+20, y: rowsY[row]}));
                    }
                }
            }
        },
        49: ()=>{
            s.button_next.children[0].enable();

            // items

            s.q49_schoolbag.addChild(new Q49.SSchoolbag());
            {
                const positions = [
                    [215, 164], [211, 242], [284, 90], [355, 90], [427, 92], [278, 173], [352, 173], [423, 173], [275, 258], [345, 258], [414, 259]
                ];
                const items = ["airpods", "charger", "pen", "textbook-1", "textbook-2", "textbook-3", "textbook-4",
                    "exercise_book-1", "exercise_book-2", "exercise_book-3", "exercise_book-4"];
                const itemsLength = items.length;
                for (let i = 0; i < itemsLength; i++) {
                    let item = items.splice(F.randomNumber(0, items.length-1), 1)[0];
                    s.q49_draggable_items.addChild(new Q49.SDraggableItems(
                        item,
                        F.randomNumber(positions[i][0]-20, positions[i][0]+20),
                        F.randomNumber(positions[i][1]-10, positions[i][1]+10),
                    ));
                }
            }

            // school subjects
            for (let i = 0; i < g.schoolSubjects.length; i++) {
                s.misc.addChild(new SSpriteImage(
                    ("49:subject-"+(g.schoolSubjects[i])), 
                    {x: 156, y: 51+(i*24), tint: "#606060"}
                ));
            }
        },
        50: ()=>{
            s.q50_arrow_level.instantiateOne();
        },
        51: ()=>{
            s.q51_bean.instantiateOne();
            for (let i = 0; i < 7; i++) {
                s.misc.addChild(new SButtonConfigurable({
                    idle: "51:note",
                    x: 144+(i*45),
                    y: 231-(i*10),
                    idleTintColor: "#000000",
                    clickProcessMessage: Msg.TICK_GAME_CLICK,

                    clickAction: (obj)=>{
                        if (s.q51_bean.children[0].processClick(i)) {
                            obj.clickable = false;
                            obj.tint = "#008000";
                        };
                    }
                }));
            }
        },
        53: ()=>{
            s.button_next.children[0].enable();

            s.q53_controller.instantiateOne();
        },
        55: ()=>{
            s.q55_background.instantiateOne();
            s.q55_question_text.instantiateOne();

            // schoolbag
            s.q49_schoolbag.addChild(new Q49.SSchoolbag());

            // selected school subject
            s.misc.addChild(new SSpriteImage(
                ("49:subject-"+(g.selectedSubject)), 
                {x: 254, y: 105, tint: "#000000"}
            ));
        },
        56: ()=>{
            s.q56_controller.instantiate();
            s.q56_question_text.instantiate();
        },
        60: ()=>{
            s.q60_pump.instantiateOne();
            s.q60_volleyball.instantiateOne();
        },
        62: ()=>{
            s.misc.addChild(new SButtonConfigurable({idle: "question-62-a", 
                x: 0, y: 0, anchor:{x:0,y:0},
                clickProcessMessage: Msg.TICK_GAME_CLICK,
                clickHitboxProps: {offsetX: 324, offsetY: 74, width: 126, height: 42},
                clickAction: s.main.fNextQuestion
            }));
        },
        63: ()=>{
            s.q63_controller.instantiateOne();
        },
        65: ()=>{
            s.misc.addChild(new Q65.S65_QuestionContent());
        },
        67: ()=>{
            let counter = 0;
            const fClickAction = ()=>{
                counter++;
                if (counter >= 67) {
                    s.main.nextQuestion();
                }
            }

            s.question_number.children[0].visible = false;
            s.misc.addChild(new SButtonConfigurable({
                idle: "question_number-67-circle",
                x: 39,
                y: 39,
                clickProcessMessage: Msg.TICK_GAME_CLICK,
                clickAction: fClickAction,
            }));
        },
        68: ()=>{
            s.button_next.children[0].enable();

            s.q68_controller.instantiateOne();
            s.q68_background.instantiateOne();
        },
        70: ()=>{
            s.q70_question_text.instantiateOne();
            s.q70_button.instantiateOne();
        }
    }
    static readonly clearQuestionFunctions: {[index: number]: ()=>void} = {
        36: ()=>{
            s.q36_controller.destroyChildren();
            s.q36_elements.destroyChildren();
            s.q36_lines.destroyChildren();
        },
        40: ()=>{
            s.q40_controller.destroyChildren();
            s.q40_background_cover.destroyChildren();
            s.q40_screen.destroyChildren();
            s.q40_screen_flash.destroyChildren();
            s.q40_buttons.destroyChildren();
            s.q40_string.destroyChildren();
            s.q40_tip.destroyChildren();
            s.q40_red_frame.destroyChildren();
        },
        44: ()=>{
            s.q44_begin_text.destroyChildren();
            s.q44_begin_point.destroyChildren();
            s.q44_maze.destroyChildren();
            s.q44_maze_text.destroyChildren();
        },
        45: ()=>{
            s.q45_controller.destroyChildren();
            s.q45_chests.destroyChildren();
            s.q45_text.destroyChildren();
        },
        49: ()=>{
            s.q49_draggable_items.destroyChildren();
            s.q49_schoolbag.destroyChildren();
        },
        50: ()=>{
            s.q50_arrow_level.destroyChildren();
        },
        51: ()=>{
            s.q51_bean.destroyChildren();
        },
        53: ()=>{
            s.q53_controller.destroyChildren();
            s.q53_draggable_items.destroyChildren();
        },
        55: ()=>{
            s.q55_background.destroyChildren();
            s.q55_question_text.destroyChildren();
            s.q49_schoolbag.destroyChildren();
            s.q49_draggable_items.destroyChildren();
        },
        56: ()=>{
            s.q56_controller.destroyChildren();
            s.q56_question_text.destroyChildren();
            s.q56_background.destroyChildren(true);
        },
        60: ()=>{
            s.q60_pump.destroyChildren();
            s.q60_volleyball.destroyChildren();
        },
        63: ()=>{
            s.q63_controller.destroyChildren();
            s.q63_matches.destroyChildren();
        },
        67: ()=>{
            s.question_number.children[0].visible = true;
        },
        68: ()=>{
            s.q68_background.destroyChildren();
            s.q68_controller.destroyChildren();
            s.q68_key_buttons.destroyChildren();
        },
        70: ()=>{
            s.q70_question_text.destroyChildren();
            s.q70_button.destroyChildren();
        }
    }

    messageStep(message: Msg) {
        switch (message) {

            case Msg.START:
                messages.broadcast(Msg.INIT_SHOW_CAUTION);
                // DEBUG
                // messages.broadcast(Msg.INIT_GAME);

                break;

            // will call once
            case Msg.INIT_SHOW_CAUTION:
                // start
                s.caution_poster.instantiateOne();
                s.button_continue.instantiateOne();
                s.caution_poster.children[0].enable();
                s.button_continue.children[0].enable();

                s.title.instantiateOne();
                s.button_play.instantiateOne();
                s.button_how_to_play.instantiateOne();
                s.button_play_part_link.instantiateOne();
                s.instruction_poster1.instantiateOne();
                s.instruction_poster2.instantiateOne();
                s.button_back.instantiateOne();

                break;

            case Msg.CLOSE_CAUTION:
                s.caution_poster.destroyChildren();
                s.button_continue.destroyChildren();
                break;

            case Msg.SHOW_MENU:
                s.title.children[0].reset1();
                s.button_play.children[0].reset1();
                s.button_how_to_play.children[0].reset1();
                s.button_play_part_link.children[0].reset1();
                this.menuIsClickable = false;

                this.animMoveIn.animationList[0].duration = 1.6;
                break;

            case Msg.SHOW_MENU2:
                s.title.children[0].reset2();
                s.button_play.children[0].reset2();
                s.button_how_to_play.children[0].reset2();
                s.button_play_part_link.children[0].reset2();

                this.animMoveIn.start();
                break;

            case Msg.HIDE_MENU:
                s.title.children[0].disable();
                s.button_play.children[0].disable();
                s.button_how_to_play.children[0].disable();
                s.button_play_part_link.children[0].disable();
                
                this.animMoveIn.animationList[0].duration = 0.8;

                break;


            case Msg.SHOW_INSTRUCTIONS:
                s.instruction_poster1.children[0].reset();
                s.instruction_poster2.children[0].reset();
                s.button_back.children[0].reset();

                this.animMoveIn.start();
                break;

            case Msg.HIDE_INSTRUCTIONS:
                s.instruction_poster1.children[0].disable();
                s.instruction_poster2.children[0].disable();
                s.button_back.children[0].disable();
                break;


            // will call once
            case Msg.INIT_GAME:
                // destroy old objects
                s.button_play.destroyChildren();
                s.button_how_to_play.destroyChildren();
                s.button_play_part_link.destroyChildren();
                s.instruction_poster1.destroyChildren();
                s.instruction_poster2.destroyChildren();
                s.button_back.destroyChildren();

                // create new objects
                for (let i = 0; i < 4; i++) {
                    s.button_choice.addChild(new SButtonChoice(i));
                }
                s.game_background_decoration.instantiateOne();
                s.lives_text.instantiateOne();
                s.lives_number.instantiateOne();
                s.question_text.instantiateOne();
                s.question_number.instantiateOne();
                s.bomb.instantiateOne();
                s.button_next.instantiateOne();

                messages.broadcast(Msg.START_GAME);
                break;


            case Msg.START_GAME:
                // disable objects
                s.effect_smudge.disable();
                s.effect_explosion.disable();
                s.game_over_poster.disable();
                s.button_play_again.disable();
                s.effect_paint.disable();

                // start game
                this.isGame = true;
                g.question = 31-1;


                g.itemsInSchoolbag.splice(0);
                // DEBUG
                // g.itemsInSchoolbag.push("textbook-1", "exercise_book-1", "textbook-3", "exercise_book-3", "textbook-2", "exercise_book-2", "pen");

                g.schoolSubjects.splice(0);
                {
                    const removedSubject = F.randomNumber(0, 3);
                    for (let i = 0; i < 4; i++) {
                        if (removedSubject !== i) {
                            g.schoolSubjects.splice(F.randomNumber(0, g.schoolSubjects.length), 0, i+1);
                        }
                    }
                }

                // DEBUG
                // g.selectedSubject = 1;
                g.selectedSubject = g.schoolSubjects[F.randomNumber(0, g.schoolSubjects.length-1)];

                g.allowedItems.splice(0);
                g.allowedItems.push("pen", `textbook-${g.selectedSubject}`, `exercise_book-${g.selectedSubject}`);

                Q49.SDraggableItems.draggingItem = null;
                g.lives = 5;
                this.nextQuestion();
                break;


            case Msg.NEXT_QUESTION:
                soundManager.produce("ding");
                this.invulnerability = 0.3;

                // creation and deletion of special objects happen automatically
                s.misc.destroyChildren();
                s.button_next.children[0].disable();
                
                g.question+=1;

                s.bomb.children[0].begin(g.TIME_BOMBS[g.question] ?? 0);
                
                break;

                
            case Msg.TICK:
                if (this.isGame) {
                    // handle clicks
                    if (this.invulnerability > 0) {
                        this.invulnerability -= m.delta;
                    }
                    if (this.canClick) {
                        messages.broadcast(Msg.TICK_GAME_CLICK);
                    }

                    // handle logic
                    messages.broadcast(Msg.TICK_GAME_LOGIC);

                    if (this.gameTick) {
                        messages.broadcast(Msg.TICK_GAME_BOMB);
                    }
                }
                else {
                    if (this.menuIsClickable) {
                        messages.broadcast(Msg.TICK_MENU_CLICK);
                    }
                    messages.broadcast(Msg.TICK_MENU_LOGIC);
                }
                break;


            case Msg.PLAY_CLICKED:
                this.menuIsClickable = false;
                this.animPlayClicked.start();

                soundManager.produce("menus:wind");

                break;

            case Msg.PLAY_AGAIN_CLICKED:
                this.menuIsClickable = false;
                this.animPlayAgainClicked.start();
                break;


            case Msg.TICK_MENU_LOGIC:
                this.animMoveIn.simulateTick();
                this.animPlayClicked.simulateTick();
                this.animPlayAgainClicked.simulateTick();
                break;


            case Msg.GAME_COMPLETE:
                this.isGame = false;

                // destroy game objects
                s.button_choice.destroyChildren();
                s.game_background_decoration.destroyChildren();
                s.lives_text.destroyChildren();
                s.lives_number.destroyChildren();
                s.question_text.destroyChildren();
                s.question_number.destroyChildren();
                s.bomb.destroyChildren();
                s.button_next.destroyChildren();

                this.menuIsClickable = false;
                s.game_complete_poster.instantiateOne();;
                break;
        }
    }
}
