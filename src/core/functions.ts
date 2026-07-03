export const SMALL = 0.000001;

export function remainder(n: number, m: number) {
    return ((n % m) + m) % m;
}
export function randomNumber(min: number, max: number, span=1) {
    return (Math.floor(Math.random()*Math.abs(max-min+span)/span)*span)+min;
}
export function scale(value: number, fromLow: number, fromHigh: number, toLow: number,
toHigh: number) {
    return ((value - fromLow) / ((fromHigh - fromLow) / (toHigh - toLow))) + toLow;
}
export function clamp(value: number, min: number, max: number) {
    if(min > max){
        let temp = min;
        min = max;
        max = temp;
    }
    return (value < min) ? min : ((value > max) ? max : value);
}
export function scaleClamp(value: number, fromLow: number, fromHigh: number, toLow:
number, toHigh: number) {
    return clamp(scale(value, fromLow, fromHigh, toLow, toHigh), toLow, toHigh);
}
export function isBetween(value: number, min: number, max: number) {
    if(min > max){
        let temp = min;
        min = max;
        max = temp;
    }
    return ((value >= min) && (value <= max));
}
export function between(min: number, max: number, range=0.5) {
    return ((max-min)*range)+min;
}
export function span(value: number, threshold=1) {
    return Math.round(value/threshold)*threshold;
}
export function arrayMove<T>(array: Array<T>, index: number, targetIndex: number) {
    array.splice(targetIndex, 0, array.splice(index, 1)[0]);
}
/**
 * Moves the point.
 * @param direction Angle in radians. 0 means to the right.
 */
export function moveBy(x: number, y: number, steps: number, direction: number) {
    const relX = steps * Math.cos(direction);
    const relY = steps * Math.sin(direction);
    return {x: (x+relX), y: (y+relY)};
}

export function distance(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
}
export function pointTowards(x1: number, y1: number, x2: number, y2: number) {
    return Math.atan2(y2-y1, x2-x1);
}
export function rotatePoint(x: number, y: number, angle: number, anchorX=0, anchorY=0) {
    const absX = x-anchorX;
    const absY = y-anchorY;
    return {
        x: (absX*Math.cos(angle) + absY*Math.sin(angle))+anchorX,
        y: (-absX*Math.sin(angle) + absY*Math.cos(angle))+anchorY
    };
}

export function ease(t: number, easeMode:
    "sineIn"|"sineOut"|"sineInOut"|"quadIn"|"quadOut"|"quadInOut"|"cubicIn"|"cubicOut"|"cubicInOut"
){
    switch (easeMode){
        case "sineIn":
            return 1 - Math.cos(t * Math.PI / 2);
        case "sineOut":
            return Math.sin(t * Math.PI / 2);
        case "sineInOut":
            return -(Math.cos(Math.PI * t) - 1) / 2;
        case "quadIn":
            return t * t;
        case "quadOut":
            return 1 - ((1-t)*(1-t));
        case "quadInOut":
            return (
                (t<0.5)
                ? (t*t*4)/2
                : 1-((1-t)*(1-t)*4)/2
            );
        case "cubicIn":
            return t * t * t;
        case "cubicOut":
            return 1 - ((1-t)*(1-t)*(1-t));
        case "cubicInOut":
            return (
                (t<0.5)
                ? (t*t*t*8)/2
                : 1-((1-t)*(1-t)*(1-t)*8)/2
            );
        default:
            return t;
    }
}

export function sklonenieNoun(number: number, singular: string, dual: string, plural: string): string {
    const absNumber = Math.abs(number);
    return (
        (absNumber%10 == 1 && !(absNumber%100 > 10 && absNumber%100 < 20)) 
        ? singular 
        : (absNumber%10 > 1 && absNumber%10 < 5 && !(absNumber%100 > 10 && absNumber%100 < 20)) 
        ? dual 
        : plural
    );
}