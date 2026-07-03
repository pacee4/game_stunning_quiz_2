import { m } from "@/core/sensing_properties";
import { soundManager } from "@/core/sound_manager";
import { settings } from "@/editable";
import { sklonenieNoun } from "@/core/functions";


export function showEl(el: HTMLElement) {
    el.classList.remove("hide");
}
export function hideEl(el: HTMLElement) {
    el.classList.add("hide");
}
export function showPanel() {
    showEl(els.panel);
}
export function hidePanel() {
    hideEl(els.panel);
}

interface ElProperties {
    text?: string,
    class?: string,
    id?: string,
    style?: Record<string, string>|string;
    children?: (Node|string)[]
}
export function createEl(tag: keyof HTMLElementTagNameMap, p: ElProperties): HTMLElement {
    const el = document.createElement(tag);

    if (p.text) {
        el.textContent = p.text;
    }
    if (p.class) {
        el.className = p.class;
    }
    if (p.id) {
        el.id = p.id;
    }
    if (p.style) {
        if (typeof(p.style) === "string") {
            el.style.cssText = p.style;
        }
        else {
            for (let [styleProperty, value] of Object.entries(p.style)) {
                el.style.setProperty(styleProperty, value);
            }
        }
    }
    if (p.children) {
        el.append(...p.children);
    }

    return el;
}

export const els = {
    panel: <HTMLDivElement>document.getElementById("g-mainPanel"),
    bFullscreen: <HTMLButtonElement>document.getElementById("g-bFullscreen"),
    bFullscreenImgSwitch: <NodeListOf<HTMLImageElement>> document.querySelectorAll("#g-bFullscreen > img"),

    fullscreenOverlay: <HTMLDivElement>document.getElementById("g-fullscreenOverlay"),

    divGame: <HTMLDivElement>document.getElementById("g-divGame"),
    divCanvasPositioning: <HTMLDivElement>document.getElementById("g-divCanvasPositioning"),
    divCanvas: <HTMLDivElement>document.getElementById("g-divCanvas"),
    divCanvasElements: <HTMLDivElement>document.getElementById("g-divCanvasElements")
}
class FullscreenPolyfill {
    static waitingForFullscreen = false;
    static isFullscreen = false;

    static isSupported: boolean;
    static event = "";
    static requestFullscreenF = "";
    static exitFullscreenF = "";

    static {
        if (document.fullscreenEnabled !== undefined) {
            this.isSupported = document.fullscreenEnabled;

            this.event = "fullscreenchange";
            this.requestFullscreenF = "requestFullscreen";
            this.exitFullscreenF = "exitFullscreen";
        }
        else if (((<any>document).webkitFullscreenEnabled) !== undefined) {
            this.isSupported = ((<any>document).webkitFullscreenEnabled);
            
            this.event = "webkitfullscreenchange";
            this.requestFullscreenF = "webkitRequestFullscreen";
            this.exitFullscreenF = "webkitExitFullscreen";
        }
        else if (((<any>document).mozFullScreenEnabled) !== undefined) {
            this.isSupported = ((<any>document).mozFullScreenEnabled);

            this.event = "mozfullscreenchange";
            this.requestFullscreenF = "mozRequestFullScreen";
            this.exitFullscreenF = "mozCancelFullScreen";
        }
        else if (((<any>document).msFullscreenEnabled) !== undefined) {
            this.isSupported = ((<any>document).msFullscreenEnabled);
            
            this.event = "msfullscreenchange";
            this.requestFullscreenF = "msRequestFullscreen";
            this.exitFullscreenF = "msExitFullscreen";
        }
        else {
            this.isSupported = false;
        }

        if (this.isSupported) {
            els.bFullscreen.classList.remove("hide2");
        }
    }
    
    static requestFullscreen(el: Element) {
        if (!this.isSupported) return;

        (<any>el)[this.requestFullscreenF]?.();
    }
    
    static exitFullscreen() {
        if (!this.isSupported) return;

        (<any>document)[this.exitFullscreenF]?.();
    }
}
class PageVisibilityPolyfill {
    static isSupported: boolean;
    static hiddenProperty = "hidden";
    static event = "";

    static {
        if (document.hidden !== undefined) {
            this.hiddenProperty = "hidden";
            this.event = "visibilitychange";
            this.isSupported = true;
        }
        else if ((document as any).webkitHidden !== undefined) {
            this.hiddenProperty = "webkitHidden";
            this.event = "webkitvisibilitychange";
            this.isSupported = true;
        }
        else if ((document as any).msHidden !== undefined) {
            this.hiddenProperty = "msHidden";
            this.event = "msvisibilitychange";
            this.isSupported = true;
        }
        else if ((document as any).mozHidden !== undefined) {
            this.hiddenProperty = "mozHidden";
            this.event = "mozvisibilitychange";
            this.isSupported = true;
        }
        else {
            this.isSupported = false;
        }
    }

    static get hidden(): boolean {
        if (!this.isSupported) return false;
        return (<any>document)[this.hiddenProperty];
    }
}

interface CustomHistoryState {
    modalOpen: boolean
}
interface GameDirectoryEntry {
    name: string,
    src: string,
    thumb_src?: string,
    date_published: string,
    date_updated?: string,

    details?: {
        categories?: {
            support?: "all"|"mobile"|"pc",
            length?: "minigame"|"plot",
            other?: string[]
        },
        powered_by?: "pixijs"|"turbowarp"|"none"
        description?: string,
        how_to_play?: string,
        credits?: string
    }
}
class Modal {
    readonly els = {
        modal: document.getElementById("g-modal") as HTMLDivElement,
        modalInnerContent: document.getElementById("g-modalInnerContent") as HTMLDivElement,
        modalDivContent: document.getElementById("g-modalDivContent") as HTMLDivElement
    };

    private formatToRuDate(date: string) {
        const parts = date.split('-');

        if (parts.length === 3) {
            // YYYY-MM-DD -> DD.MM.YYYY
            const [year, month, day] = parts;
            return `${day}.${month}.${year}`;
        }
        else if (parts.length === 2) {
            // YYYY-MM -> MM.YYYY
            const [year, month] = parts;
            return `${month}.${year}`;
        }

        // YYYY -> YYYY
        return date;
    }
    private formatToISODate(date: string) {
        const parts = date.split('.');

        if (parts.length === 3) {
            // DD.MM.YYYY -> YYYY-MM-DD
            const [day, month, year] = parts;
            return `${year}-${month}-${day}`;
        }
        else if (parts.length === 2) {
            // MM.YYYY -> YYYY-MM
            const [month, year] = parts;
            return `${year}-${month}`;
        }

        return date;
    }
    private getApproximatePeriodUntilToday(dateString: string): string {
        const parts: string[] = (
            (dateString.indexOf(".") !== -1)
            ? dateString.split(".").reverse()
            : (dateString.indexOf("-") !== -1)
            ? dateString.split("-")
            : [dateString]
        );
        
        const pastDateN = {
            year: parseInt(parts[0]),
            /** Здесь январь - это нулевой месяц, как допустимо в синтаксисе класса Date */
            month: (parts.length >= 2) ? parseInt(parts[1])-1 : 0,
            day: (parts.length >= 3) ? parseInt(parts[2]) : 1,
            priority: parts.length-1
        };
        
        // Получение сегодняшней даты
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let years = (today.getFullYear() - pastDateN.year);
        let months = (today.getMonth() - pastDateN.month);
        let days = (today.getDate() - pastDateN.day);

        // Коррекция периода
        if (days < 0) {
            months--;
            const previousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += previousMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        if (years > 0) {
            return `${years} ${sklonenieNoun(years, "год", "года", "лет")} назад`;
        }
        else if (months > 0) {
            return `${months} ${sklonenieNoun(months, "месяц", "месяца", "месяцев")} назад`;
        }
        else {
            if (days === 0) {
                return "сегодня";
            }
            else if (days === 1) {
                return "вчера";
            }
            else {
                return `${days} ${sklonenieNoun(days, "день", "дня", "дней")} назад`;
            }
        }
    }
    private createDate(text: string, entryDate: string) {
        const el = document.createElement("p");
        el.classList.add("info");
        
        const elTime = document.createElement("time");
        elTime.textContent = this.formatToRuDate(entryDate);
        elTime.dateTime = this.formatToISODate(entryDate);
        const elSpan = createEl("span", {
            class: "date-period",
            text: `(${this.getApproximatePeriodUntilToday(entryDate)})`
        });

        el.append(`${text} `, elTime, " ", elSpan);
        return el;
    }
    private buildSectionBlock(targetElement: Node, heading: string, content?: string) {
        if (content) {
            const elSection = createEl("section", {
                class: "mp m bottom-2",
                children: [
                    createEl("h2", { text: heading }),
                    this.createFormattedText(content)
                ]
            });
            targetElement.appendChild(elSection);
        }
    }
    private createFormattedText(text: string) {
        const formattedEl = document.createElement("p");
        formattedEl.classList.add("pre-line");
        
        // Сгенерировано ИИ //

        // 1. Регулярное выражение ищет жирный текст, курсив и ссылки [текст](ссылка), игнорируя экранированные символы
        const regex = /(?<!\\)(\*\*.*?(?<!\\)\*\*|(?<!\\)\*.*?(?<!\\)\*|(?<!\\)\[.*?(?<!\\)\]\((?<!\\).*?(?<!\\)\))/g;
        const tokens = text.split(regex);

        tokens.forEach(token => {
            if (token.startsWith('**') && token.endsWith('**')) {
                const boldElement = document.createElement('strong');
                boldElement.textContent = token.slice(2, -2).replace(/\\([\*\*\[\]\(\)])/g, '$1');
                formattedEl.appendChild(boldElement);
            } 
            else if (token.startsWith('*') && token.endsWith('*')) {
                const italicElement = document.createElement('em');
                italicElement.textContent = token.slice(1, -1).replace(/\\([\*\*\[\]\(\)])/g, '$1');
                formattedEl.appendChild(italicElement);
            } 
            // 2. Обработка ссылок [текст](ссылка)
            else if (token.startsWith('[') && token.endsWith(')')) {
                const linkElement = document.createElement('a');
                
                // Разделяем текст ссылки и URL по последней закрывающей квадратной скобке и открывающей круглой
                const match = token.match(/^\[(.*?(?<!\\))\]\((.*?(?<!\\))\)$/);
                
                if (match) {
                    const linkText = match[1];
                    const linkUrl = match[2];
                    
                    linkElement.textContent = linkText.replace(/\\([\*\*\[\]\(\)])/g, '$1');
                    linkElement.href = linkUrl.replace(/\\([\*\*\[\]\(\)])/g, '$1');
                    
                    // Опционально: открывать в новой вкладке внешние ссылки
                    linkElement.target = '_blank';
                    linkElement.rel = 'noopener noreferrer';
                    
                    formattedEl.appendChild(linkElement);
                } else {
                    // Если структура нарушена, выводим как обычный текст
                    const cleanText = token.replace(/\\([\*\*\[\]\(\)])/g, '$1');
                    formattedEl.appendChild(document.createTextNode(cleanText));
                }
            }
            else if (token) {
                // Очищаем обычный текст от любых экранирующих слэшей для спецсимволов
                const cleanText = token.replace(/\\([\*\*\[\]\(\)])/g, '$1');
                formattedEl.appendChild(document.createTextNode(cleanText));
            }
        });

        return formattedEl;
    }
    private updateScrollGradients() {
        if (this.els.modalInnerContent.scrollTop <= 0) {
            this.els.modalInnerContent.classList.add("js-atTop");
        } else {
            this.els.modalInnerContent.classList.remove("js-atTop");
        }
    }

    fetchInfo(url: string) {
        fetch(url) // изменить на "/games/game_directory.json"
        .then((response)=>{
            if (!response.ok) throw new Error(`Cannot load file: ${response.url}`);
            return (response.json() as Promise<Array<GameDirectoryEntry>>);
        })
        .then((json)=>{
            // когда JSON-файл успешно загружен
            const entry = json.find((entry)=>(entry.name.toLowerCase() === document.title.toLowerCase()))
            if (!entry) throw new Error(`No match with the title: ${document.title}`);
            
            // когда получена информация по заголовку
            this.placeInfo(entry);
        })
        .catch((error)=>{
            document.querySelector("#g-modalDivContent > p")!.textContent = "Не удалось загрузить информацию";

            console.warn(error);
        });
    }
    private placeInfo(entry: GameDirectoryEntry) {
        this.els.modalDivContent.textContent = "";
        const f = document.createDocumentFragment();

        // categories
        {
            f.appendChild(createEl("p", {
                class: "info m bottom-0 bold",
                text: "Категории:"
            }));

            const mwCategories = document.createElement("ul");
            mwCategories.classList.add("info");

            const {
                support = "all",
                length = "minigame",
                other = []
            } = entry.details?.categories ?? {};

            // support
            const elSupport = document.createElement("li");
            switch (support) {
                case "mobile":
                    elSupport.textContent = "только для моб. устройств";
                    elSupport.dataset.support = "mobile";
                    break;
                case "pc":
                    elSupport.textContent = "только для ПК";
                    elSupport.dataset.support = "pc";
                    break;
                default:
                    elSupport.textContent = "для всех устройств";
                    elSupport.dataset.support = "";
                    break;
            }
            mwCategories.appendChild(elSupport);

            // length
            const elLength = document.createElement("li");
            elLength.textContent = (length==="plot") ? "сюжетная игра" : "мини-игра";
            mwCategories.appendChild(elLength);

            // other
            if (Array.isArray(other)) { // type-guard to avoid error
                other.forEach((value)=>{
                    mwCategories.appendChild(createEl("li", {text: value}));
                });
            }

            f.appendChild(mwCategories);
        }

        // metadata
        {
            const div = createEl("div", {class: "m bottom-4"});
            // datePublished
            div.appendChild(this.createDate("Опубликовано", entry.date_published));
            // dateUpdated
            const dateUpdated = entry.date_updated;
            if (dateUpdated) div.appendChild(this.createDate("Обновлено", dateUpdated));
            // powered_by
            {
                const poweredBy = entry.details?.powered_by ?? "none";
                if (poweredBy!=="none")
                    div.appendChild(createEl("p", {class: "info t-blue", text: (
                        (poweredBy==="turbowarp")
                        ? "Создано на Scratch с использованием сторонних утилит TurboWarp и TurboWarp Packager."
                        : "Работает на браузерном игровом движке PixiJS."
                    )}));
            }

            f.appendChild(div);
        }
        
        // description
        this.buildSectionBlock(f, "Описание игры", entry.details?.description);
        // how_to_play
        this.buildSectionBlock(f, "Как играть", entry.details?.how_to_play);
        // credits
        this.buildSectionBlock(f, "Благодарность", entry.details?.credits);

        this.els.modalDivContent.appendChild(f);
    }

    constructor() {
        document.getElementById("g-mwName")!.textContent = document.title;

        // Добавить обработчики событий

        // кнопка "Информация"
        document.getElementById("g-bInfo")!.addEventListener("click", ()=>{
            this.open();
        });

        // кнопка "Закрыть"
        document.getElementById("g-mwAClose")!.addEventListener("click", ()=>{
            this.close();
        });

        // если пользователь нажал на затемнённое место, закрыть модальное окно
        this.els.modal.addEventListener("click", (event)=>{
            if ((event.target as HTMLElement).classList.contains("js-closeModal")) {
                this.close();
            }
        });

        // если пользователь нажал клавишу "Esc", закрыть модальное окно
        document.addEventListener("keydown", (event)=>{
            if (!this.els.modal.classList.contains("hide") && event.key === "Escape") {
                this.close();
            }
        });

        // если пользователь нажал в браузере кнопку «Назад», закрыть модальное окно
        window.addEventListener("popstate", ()=>{
            this.closeModalP();
        });

        // обновление прокрутки
        this.els.modalInnerContent.addEventListener("scroll", this.updateScrollGradients.bind(this));
    }

    open() {
        showEl(this.els.modal);

        // обнулить позицию прокрутки в содержимом модального окна
        this.els.modalInnerContent.scrollTop = 0;
        this.els.modalInnerContent.classList.add("js-atTop");

        // Добавляем запись в историю браузера
        const state: CustomHistoryState = {modalOpen: true};
        window.history.pushState(state, "");

        UI.fullscreenDialog.close();
        UI.updateGameFocus();
    }
    close() {
        // Получаем запись из истории браузера
        return new Promise<void>((resolve)=>{
            const currentState = history.state as CustomHistoryState|null;
            if (currentState?.modalOpen) {
                window.addEventListener("popstate", ()=>{
                    UI.updateGameFocus();
                    resolve();
                }, {once: true});
                history.back();
            }
            // Закрываем модальное окно
            else {
                this.closeModalP();
                UI.updateGameFocus();
                resolve();
            }
        });
    }
    isShown() {
        return !this.els.modal.classList.contains("hide");
    }
    private closeModalP() {
        hideEl(this.els.modal);
    }
}


class FullscreenDialog {
    private updateBFullscreenImg() {
        els.bFullscreenImgSwitch.forEach((el)=>{hideEl(el);});
        if (FullscreenPolyfill.isFullscreen) {
            showEl(els.bFullscreenImgSwitch[1]);
        }
        else if (FullscreenPolyfill.waitingForFullscreen) {
            showEl(els.bFullscreenImgSwitch[2]);
        }
        else {
            showEl(els.bFullscreenImgSwitch[0]);
        }
    }

    open() {
        if (!FullscreenPolyfill.waitingForFullscreen) {
            FullscreenPolyfill.waitingForFullscreen = true;
            showEl(els.fullscreenOverlay);
            this.updateBFullscreenImg();
            UI.updateGameFocus();
        }
    }
    close() {
        if (FullscreenPolyfill.waitingForFullscreen) {
            FullscreenPolyfill.waitingForFullscreen = false;
            hideEl(els.fullscreenOverlay);
            this.updateBFullscreenImg();
            UI.updateGameFocus();
        }
    }
    isShown() {
        return !els.fullscreenOverlay.classList.contains("hide");
    }

    public orientationMedia = 
        (settings.SCREEN_WIDTH !== settings.SCREEN_HEIGHT)
        ? window.matchMedia(
            `(orientation: ${(settings.SCREEN_WIDTH > settings.SCREEN_HEIGHT) ? "landscape" : "portrait"}`
        )
        : null;

    setEvents() {
        document.querySelector("#g-fullscreenOverlay p")!.textContent = `Поверните устройство в ${(settings.SCREEN_WIDTH > settings.SCREEN_HEIGHT) ? "горизонтальное" : "вертикальное"} положение`;

        if (FullscreenPolyfill.isSupported) {
            // when the button clicked
            els.fullscreenOverlay.addEventListener("click", ()=>{
                this.close();
            });

            els.bFullscreen.addEventListener("click", ()=>{
                if (FullscreenPolyfill.waitingForFullscreen) {
                    this.close();
                }
                else {
                    if (!FullscreenPolyfill.isFullscreen) {
                        if (!m.isFocused) {
                            if (m.isMobile && (this.orientationMedia && !this.orientationMedia.matches)) {
                                this.open();
                            }
                            else {
                                FullscreenPolyfill.requestFullscreen(document.documentElement);
                            }
                        }
                    }
                    else {
                        FullscreenPolyfill.exitFullscreen();
                    }
                }
            });

            // when the screen orientation is changed
            this.orientationMedia?.addEventListener("change", (event)=>{
                if (FullscreenPolyfill.waitingForFullscreen && event.matches) {
                    FullscreenPolyfill.requestFullscreen(document.documentElement);
                    this.close();
                }
            });

            // when the fullscreen mode is toggled
            document.addEventListener(FullscreenPolyfill.event, ()=>{
                FullscreenPolyfill.isFullscreen = Boolean(document.fullscreenElement);
                this.updateBFullscreenImg();
            });
        }
    }
}

export class UI {
    private static eventSwitchGameFocus = new CustomEvent<void>("custom-switchgamefocus");
    static gameIsFocused = true;
    static updateGameFocus() {
        this.gameIsFocused = !this.modal.isShown() && !this.fullscreenDialog.isShown();
        document.dispatchEvent(this.eventSwitchGameFocus);
    }

    static fullscreenDialog = new FullscreenDialog();
    static modal = new Modal();

    static setGameEvents() {
        this.fullscreenDialog.setEvents();

        // check document on activity
        if (PageVisibilityPolyfill.isSupported) {
            document.addEventListener(PageVisibilityPolyfill.event, ()=>{
                if (PageVisibilityPolyfill.hidden) {
                    soundManager.pauseCtx();
                }
                else {
                    soundManager.resumeCtx();
                }
            });
            if (PageVisibilityPolyfill.hidden) {
                soundManager.pauseCtx();
            }
        }
    }
}
