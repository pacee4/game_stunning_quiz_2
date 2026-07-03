import { TopContainer, SmoothText } from "@/core/core";


// QUESTION 65
export class S65_QuestionContent extends TopContainer {
    constructor() {
        super();
        const t_question = new SmoothText({
            text: "\u26ab\ufe0f\u2754\ud83d\udc26\ud83d\udcaa\ud83d\udeab\u2708\ufe0f\u2753",
            x: 250,
            y: 60,
            anchor: 0.5, style: {fontFamily: "sans-serif", fontSize: 36},
        });

        const t_answers: SmoothText[] = [];
        {
            const answers = ["\ud83d\udc27", "\u2708\ufe0f\ud83d\udc69\u200d\u2708", "\ud83e\udd87", "\ud83d\ude9c"];
            for (let i = 0; i < 4; i++) {
                t_answers.push(new SmoothText({
                    text: answers[i],
                    x: (i % 2 == 0) ? (126) : (354),
                    y: (Math.floor(i / 2) == 0) ? (200) : (270),
                    anchor: 0.5, style: {fontFamily: "sans-serif", fontSize: 36},
                }));
            }
        }

        this.addChild(t_question, ...t_answers);
    }
}
