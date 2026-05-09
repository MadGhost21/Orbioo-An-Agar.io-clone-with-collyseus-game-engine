import { AgarioConfig } from "./AgarioConfig.js";

export const AgarioUtils = {
    validNick: function (nickname: string) {
        const regex = /^\w*$/;
        return regex.exec(nickname) !== null;
    },

    // determine mass from radius of circle
    massToRadius: function (mass: number) {
        return 4 + Math.sqrt(mass) * 6;
    },

    // overwrite Math.log function
    mathLog: function (n: number, base: number) {
        const log = Math.log;
        return log(n) / (base ? log(base) : 1);
    },

    // get the Euclidean distance between the edges of two shapes
    getDistance: function (p1: any, p2: any) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - (p1.radius || 0) - (p2.radius || 0);
    },

    randomInRange: function (from: number, to: number) {
        return Math.floor(Math.random() * (to - from)) + from;
    },

    // generate a random position within the field of play
    randomPosition: function (radius: number) {
        return {
            x: this.randomInRange(radius, AgarioConfig.gameWidth - radius),
            y: this.randomInRange(radius, AgarioConfig.gameHeight - radius)
        };
    },

    randomColor: function () {
        const color = '#' + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
        const c: any = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        const r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
        const g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
        const b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;

        return {
            fill: color,
            border: '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
        };
    },

    getIndexes: (array: any[], predicate: (v: any) => boolean) => {
        return array.reduce((acc, value, index) => {
            if (predicate(value)) {
                acc.push(index)
            }
            return acc;
        }, [] as number[]);
    }
};
