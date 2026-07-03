import { Main } from "./sprite_main";

class GlobalProperties {
    lives = 0;
    private questionN = 0;
    
    get question() {
        return this.questionN;
    }
    /** custom setter */
    set question(b: number) {
        if (Main.clearQuestionFunctions[this.questionN]) {
            Main.clearQuestionFunctions[this.questionN]();
        }
        this.questionN = b;
        if (Main.startQuestionFunctions[this.questionN]) {
            Main.startQuestionFunctions[this.questionN]();
        }
    }

    itemsInSchoolbag: string[] = [];
    schoolSubjects: number[] = [];
    allowedItems: string[] = [];
    selectedSubject: number = 0;

    readonly CORRECT_ANSWERS: {[index: number]: number} = {
        31: 1,
        32: 1,
        33: 4,
        34: 1,
        35: 2,
        38: 4,
        39: 3,
        41: 3,
        42: 1,
        43: 3,
        46: 3,
        47: 2,
        52: 1,
        54: 4,
        56: 3,
        57: 3,
        58: 2,
        59: 3,
        61: 2,
        62: 5,
        64: 2,
        65: 1,
        66: 4,
        67: 5,
        69: 2,
    }
    readonly TIME_BOMBS: {[index: number]: number} = {
        50: 15,
        55: 10,
        57: 10,
        60: 10,
        66: 10,
        68: 10,
        70: 15
    }
    readonly ILLUSTRATION_QUESTIONS = [39, 57];

    readonly RUSSIAN_LETTERS = "абвгдежзийклмнопрстуфхцчшщъыьэюя";
}
export const g = new GlobalProperties();