import * as PIXI from "pixi.js";
import { Msg } from "@/editable";
import { TopLogicObject, TopSprite, TopContainer, Collection, AutoCollection, ObjectPool } from "@/core/core";
import { messages, layers } from "@/core/sensing_properties";

import * as S1 from "@/sprites/sprite_main";
import * as Q36 from "./q36";
import * as Q40 from "./q40";
import * as Q44 from "./q44";
import * as Q45 from "./q45";
import * as Q49 from "./q49";
import * as Q50 from "./q50";
import * as Q51 from "./q51";
import * as Q53 from "./q53";
import * as Q55 from "./q55";
import * as Q56 from "./q56";
import * as Q60 from "./q60";
import * as Q63 from "./q63";
import * as Q65 from "./q65";
import * as Q68 from "./q68";
import * as Q70 from "./q70";
import * as S2 from "./sprites";

// SPRITE STORAGE
type TopObjectOrCollection = TopLogicObject|Collection;
export class SpriteStorage {
//#region 
    main = new S1.Main();
    background = new S2.GBackground();

    // menus
    title = new AutoCollection(()=>new S2.STitle());

    caution_poster = new AutoCollection(()=>new S2.SCautionPoster());
    button_continue = new AutoCollection(()=>new S2.SButtonContinue());

    instruction_poster1 = new AutoCollection(()=>new S2.SInstructionsPoster1());
    instruction_poster2 = new AutoCollection(()=>new S2.SInstructionsPoster2());
    button_back = new AutoCollection(()=>new S2.SButtonBack());

    button_play = new AutoCollection(()=>new S2.SButtonPlay());
    button_how_to_play = new AutoCollection(()=>new S2.SButtonHowToPlay());
    button_play_part_link = new AutoCollection(()=>new S2.SButtonPlayPartLink());


    // game
    game_background_decoration = new AutoCollection(()=>new S2.SGameBackgroundDecoration());
    button_choice = new Collection<S2.SButtonChoice>();
    button_next = new AutoCollection(()=>new S2.SButtonNext());
    misc = new Collection();

    question_text = new AutoCollection(()=>new S2.SQuestionText());
    question_number = new AutoCollection(()=>new S2.SQuestionNumber());
    lives_text = new AutoCollection(()=>new S2.SLivesText());
    lives_number = new AutoCollection(()=>new S2.SLivesNumber());
    bomb = new AutoCollection(()=>new S2.SBomb());
    
    // game over
    effect_explosion = new S2.SEffectExplosion();
    effect_smudge = new S2.SEffectSmudge();

    game_over_poster = new S2.SGameOverPoster();
    button_play_again = new S2.SButtonPlayAgain();

    effect_paint = new S2.SEffectPaint();
    effect_plain_cover = new S2.SEffectPlainCover();

    // question 36
    q36_controller = new AutoCollection(()=>new Q36.S36_Controller());
    q36_elements = new Collection<Q36.S36_Elements>();
    q36_lines = new Collection<Q36.S36_Lines>();

    // question 40
    q40_controller = new AutoCollection(()=>new Q40.SController());

    q40_background_cover = new AutoCollection(()=>new Q40.SBackgroundCover());
    q40_screen = new AutoCollection(()=>new Q40.SScreen());
    q40_screen_flash = new AutoCollection(()=>new Q40.SScreenFlash());
    q40_red_frame = new AutoCollection(()=>new Q40.SRedFrame());

    q40_string = new AutoCollection(()=>new Q40.SString());
    q40_buttons = new Collection<Q40.SButtons>();
    q40_tip = new AutoCollection(()=>new Q40.SFadeTip());

    q44_begin_text = new AutoCollection(()=>new Q44.SBeginText());
    q44_begin_point = new AutoCollection(()=>new Q44.SBeginPoint());
    q44_maze = new AutoCollection(()=>new Q44.SMaze());
    q44_maze_text = new AutoCollection(()=>new Q44.SMazeText());
    
    q45_controller = new AutoCollection(()=>new Q45.SController());
    q45_chests = new Collection<Q45.SChests>();
    q45_text = new AutoCollection(()=>new Q45.SText());

    q49_draggable_items = new Collection<Q49.SDraggableItems>();
    q49_schoolbag = new Collection<Q49.SSchoolbag>();

    q50_arrow_level = new AutoCollection(()=>new Q50.SArrowLevel());

    q51_bean = new AutoCollection(()=>new Q51.SBeanAndController());

    q53_controller = new AutoCollection(()=>new Q53.SController());
    q53_draggable_items = new Collection<Q53.SDraggableItems>();

    q55_background = new AutoCollection(()=>new Q55.SBackground());
    q55_question_text = new AutoCollection(()=>new Q55.SQuestionText());

    q56_controller = new AutoCollection(()=>new Q56.SController());
    q56_question_text = new AutoCollection(()=>new Q56.SQuestionText());
    q56_background = new Collection<Q56.SBackground>();

    q60_pump = new AutoCollection(()=>new Q60.SPump());
    q60_volleyball = new AutoCollection(()=>new Q60.SVolleyball());
    
    q63_controller = new AutoCollection(()=>new Q63.SController());
    q63_matches = new Collection<Q63.SMatches>();

    q68_background = new AutoCollection(()=>new Q68.SBackground());
    q68_controller = new AutoCollection(()=>new Q68.SController());
    q68_key_buttons = new Collection<Q68.SKeyButtons>();
    
    q70_question_text = new AutoCollection(()=>new Q70.SQuestionText());
    q70_button = new AutoCollection(()=>new Q70.SButton());

    game_complete_poster = new AutoCollection(()=>new S2.SGameCompletePoster());

    //#endregion
    objectList(): TopObjectOrCollection[] {

        // add objects to the logic and drawing order (EDITABLE)
        return [
            this.main, this.background,
            this.q55_background, this.q56_background, this.q68_background,

            this.game_background_decoration,

            this.title,

            this.caution_poster, this.button_continue,
            this.instruction_poster2, this.instruction_poster1, this.button_back,

            this.button_play, this.button_how_to_play, this.button_play_part_link,

            this.button_choice, this.question_text, this.q55_question_text, this.q56_question_text,

            this.misc,

            this.q36_controller,
            this.q36_lines, this.q36_elements,

            this.q40_controller, 
            this.q40_screen, this.q40_screen_flash, this.q40_string,
            this.q40_background_cover, this.q40_red_frame, this.q40_buttons, this.q40_tip,

            this.q44_maze, this.q44_maze_text, this.q44_begin_text, this.q44_begin_point,

            this.q45_controller, this.q45_text, this.q45_chests,

            this.q49_schoolbag, this.q49_draggable_items,

            this.q50_arrow_level,

            this.q51_bean,

            this.q53_controller, this.q53_draggable_items,

            this.q56_controller,

            this.q60_pump, this.q60_volleyball,
            
            this.q63_controller, this.q63_matches,

            this.q68_controller, this.q68_key_buttons,

            this.q70_question_text, this.q70_button,
            
            this.question_number, this.bomb, this.effect_explosion,
            this.lives_text, this.lives_number, this.button_next,

            this.effect_plain_cover,
            this.effect_smudge, this.game_over_poster, this.button_play_again, this.effect_paint,

            this.game_complete_poster
        ];
    }

    //#region
    /** The basic container of all objects */
    readonly container: PIXI.Container<TopObjectOrCollection | PIXI.RenderLayer> = new PIXI.Container();

    constructor() {
        s = this;

        this.container.interactiveChildren = false;
        this.container.accessibleChildren = false;
        this.container.cullableChildren = false;

        for (let topObject of this.objectList()) {
            this.container.addChild(topObject);
        }
        // add layers for rendering objects
        for (let layer of layers) {
            this.container.addChild(layer);
        }
    }

    // sprite service functions
 
    updateObjects() {
        // messageStep
        messages.broadcast(Msg.TICK);
        const objectsToDelete: TopLogicObject[] = [];
        while (messages.hasMessages()) {
            let message = messages.obtain()!;
            if (window.debugTools && window.debugTools.logMessages) {
                window.debugTools.calledMessages.push(message)
            };

            for (const topElement of this.container.children) {
                if (topElement instanceof Collection) {
                    for (const child of topElement.children) {
                        if (child.enabled && !child.new && !(child.delete || (child.master && child.master.delete))) {
                            child.messageStep(message, this);
                        }
                    }
                }
                else if (!(topElement instanceof PIXI.RenderLayer)) {
                    if (topElement.enabled && !topElement.new) {
                        topElement.messageStep(message, this);
                    }
                }
            }
        }

        // handle deletion of objects
        for (const topElement of this.container.children) {
            if (topElement instanceof Collection) {
                for (const child of topElement.children) {
                    if (child.delete || (child.master && child.master.delete)) {
                        child.delete = true;
                        objectsToDelete.push(child);
                    }
                }
            }
        }
        for (const child of objectsToDelete) {
            if (child.belongsToPool) {
                child.belongsToPool.release(child);
            }
            else {
                child.destroy(child.deleteOptionsH);
            }
        }

        this.takeNewFromObjects();
    }

    takeNewFromObjects(){
        for (const topElement of this.container.children) {
            if (topElement instanceof Collection) {
                for (const child of topElement.children) {
                    if (child.new) {
                        child.new = false;
                    }
                }
            }
            else if (!(topElement instanceof PIXI.RenderLayer)) {
                if (topElement.new) {
                    topElement.new = false;
                }
            }
        }
    }
    //#endregion
}

/** When constructing a sprite while the project is loading, the sprite storage is not yet accessible.
 * 
 * Example 1: pass another sprite as a constructor parameter
 * ```
 * constructor(another_sprite: SAnotherSprite) {
 *      console.log(another_sprite);
 * }
 * ```
 * Example 2: obtain another sprite from the storage when the message `Msg.START` is broadcast
 * ```
 * messageStep(message: Msg) {
 *      switch (message) {
 *          case Msg.START:
 *              console.log(s.another_sprite);
 *              break;
 *      }
 * }
 * ```
 */
export let s: SpriteStorage = (undefined as any);