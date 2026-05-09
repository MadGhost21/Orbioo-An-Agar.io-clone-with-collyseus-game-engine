export interface SkinDefinition {
    id: string;
    label: string;
    type: 'color' | 'image';
    category?: string;
    bodyColor?: string;
    bodyHue?: number;
    shotHue?: number;
    shotColor?: string;
    imageUrl?: string;
    glowColor?: string;
    symbol?: string;
    borderColor?: string;
    textColor?: string;
}

export const SkinsRegistry: SkinDefinition[] = [
    // ── BASIC COLORS (10) ───────────────────────────────────
    { id: "black",   label: "Black",   type: "color", category: "Basic", bodyHue: 0,   shotHue: 0,   bodyColor: "#000000" },
    { id: "white",   label: "White",   type: "color", category: "Basic", bodyHue: 0,   shotHue: 0,   bodyColor: "#ffffff" },
    { id: "red",     label: "Red",     type: "color", category: "Basic", bodyHue: 0,   shotHue: 20,  bodyColor: "#ff0000" },
    { id: "blue",    label: "Blue",    type: "color", category: "Basic", bodyHue: 220, shotHue: 190, bodyColor: "#0000ff" },
    { id: "green",   label: "Green",   type: "color", category: "Basic", bodyHue: 120, shotHue: 100, bodyColor: "#00ff00" },
    { id: "yellow",  label: "Yellow",  type: "color", category: "Basic", bodyHue: 60,  shotHue: 40,  bodyColor: "#ffff00" },
    { id: "orange",  label: "Orange",  type: "color", category: "Basic", bodyHue: 30,  shotHue: 15,  bodyColor: "#ffa500" },
    { id: "purple",  label: "Purple",  type: "color", category: "Basic", bodyHue: 280, shotHue: 260, bodyColor: "#800080" },
    { id: "pink",    label: "Pink",    type: "color", category: "Basic", bodyHue: 330, shotHue: 300, bodyColor: "#ffc0cb" },
    { id: "gray",    label: "Gray",    type: "color", category: "Basic", bodyHue: 0,   shotHue: 0,   bodyColor: "#808080" },


    // ── ANIMALS (FLAT STYLE) ───────────────────────────────
    { id: "lion",   label: "Lion",  type: "image", category: "Animals", bodyColor: "#daa520", imageUrl: "/img/skins/animals/lion.png" },
    { id: "tiger",  label: "Tiger", type: "image", category: "Animals", bodyColor: "#ff8c00", imageUrl: "/img/skins/animals/tiger.png" },
    { id: "dog",    label: "Dog",   type: "image", category: "Animals", bodyColor: "#f4a460", imageUrl: "/img/skins/animals/dog.png" },
    { id: "cat",    label: "Cat",   type: "image", category: "Animals", bodyColor: "#333333", imageUrl: "/img/skins/animals/cat.png" },
    { id: "wolf",   label: "Wolf",  type: "image", category: "Animals", bodyColor: "#708090", imageUrl: "/img/skins/animals/wolf.png" },
    { id: "eagle",  label: "Eagle", type: "image", category: "Animals", bodyColor: "#ffffff", imageUrl: "/img/skins/animals/eagle.png" },
    { id: "bear",   label: "Bear",  type: "image", category: "Animals", bodyColor: "#8b4513", imageUrl: "/img/skins/animals/bear.png" },


    // ── ELEMENTS 1.0 (CINEMATIC) ──────────────────────────
    { id: "fire_e",      label: "Fire",      type: "image", category: "Elements", bodyColor: "#ff4500", imageUrl: "/img/skins/elements/fire.png", glowColor: "#ff4500" },
    { id: "ice_e",       label: "Ice",       type: "image", category: "Elements", bodyColor: "#00ffff", imageUrl: "/img/skins/elements/ice.png", glowColor: "#00ffff" },
    { id: "earth_e",     label: "Earth",     type: "image", category: "Elements", bodyColor: "#228b22", imageUrl: "/img/skins/elements/earth.png", glowColor: "#228b22" },
    { id: "wind_e",      label: "Wind",      type: "image", category: "Elements", bodyColor: "#f0ffff", imageUrl: "/img/skins/elements/wind.png", glowColor: "#f0ffff" },
    { id: "lightning_e", label: "Lightning", type: "image", category: "Elements", bodyColor: "#ffff00", imageUrl: "/img/skins/elements/lightning.png", glowColor: "#ffff00" },
    { id: "water_e",     label: "Water",     type: "image", category: "Elements", bodyColor: "#1e90ff", imageUrl: "/img/skins/elements/water.png", glowColor: "#1e90ff" },

    // ── ARABIC COUNTRIES ───────────────────────────────────
    { id: "dz", label: "Algeria",     type: "image", category: "Flags", bodyColor: "#006233", imageUrl: "/img/skins/flags/dz.svg" },
    { id: "ps", label: "Palestine",   type: "image", category: "Flags", bodyColor: "#000000", imageUrl: "/img/skins/flags/ps.svg" },
    { id: "ma", label: "Morocco",     type: "image", category: "Flags", bodyColor: "#c1272d", imageUrl: "/img/skins/flags/ma.svg" },
    { id: "tn", label: "Tunisia",     type: "image", category: "Flags", bodyColor: "#e70013", imageUrl: "/img/skins/flags/tn.svg" },
    { id: "eg", label: "Egypt",       type: "image", category: "Flags", bodyColor: "#ce1126", imageUrl: "/img/skins/flags/eg.svg" },
    { id: "sa", label: "Saudi Arabia",type: "image", category: "Flags", bodyColor: "#006c35", imageUrl: "/img/skins/flags/sa.svg" },
    { id: "ae", label: "UAE",          type: "image", category: "Flags", bodyColor: "#00732f", imageUrl: "/img/skins/flags/ae.svg" },
    { id: "qa", label: "Qatar",       type: "image", category: "Flags", bodyColor: "#8d1b3d", imageUrl: "/img/skins/flags/qa.svg" },
    { id: "kw", label: "Kuwait",      type: "image", category: "Flags", bodyColor: "#007a3d", imageUrl: "/img/skins/flags/kw.svg" },
    { id: "jo", label: "Jordan",      type: "image", category: "Flags", bodyColor: "#000000", imageUrl: "/img/skins/flags/jo.svg" },
    { id: "lb", label: "Lebanon",     type: "image", category: "Flags", bodyColor: "#ed1c24", imageUrl: "/img/skins/flags/lb.svg" },
    { id: "sy", label: "Syria",       type: "image", category: "Flags", bodyColor: "#ce1126", imageUrl: "/img/skins/flags/sy.svg" },
    { id: "iq", label: "Iraq",        type: "image", category: "Flags", bodyColor: "#ce1126", imageUrl: "/img/skins/flags/iq.svg" },
    { id: "om", label: "Oman",        type: "image", category: "Flags", bodyColor: "#008000", imageUrl: "/img/skins/flags/om.svg" },
    { id: "ye", label: "Yemen",       type: "image", category: "Flags", bodyColor: "#ce1126", imageUrl: "/img/skins/flags/ye.svg" },
    { id: "ly", label: "Libya",       type: "image", category: "Flags", bodyColor: "#000000", imageUrl: "/img/skins/flags/ly.svg" },
    { id: "sd", label: "Sudan",       type: "image", category: "Flags", bodyColor: "#ce1126", imageUrl: "/img/skins/flags/sd.svg" },
    { id: "bh", label: "Bahrain",     type: "image", category: "Flags", bodyColor: "#ce1126", imageUrl: "/img/skins/flags/bh.svg" },

    // ── FAMOUS COUNTRIES ────────────────────────────────────
    { id: "us", label: "USA",         type: "image", category: "Flags", bodyColor: "#3c3b6e", imageUrl: "/img/skins/flags/us.svg" },
    { id: "gb", label: "UK",          type: "image", category: "Flags", bodyColor: "#00247d", imageUrl: "/img/skins/flags/gb.svg" },
    { id: "fr", label: "France",      type: "image", category: "Flags", bodyColor: "#002395", imageUrl: "/img/skins/flags/fr.svg" },
    { id: "de", label: "Germany",     type: "image", category: "Flags", bodyColor: "#000000", imageUrl: "/img/skins/flags/de.svg" },
    { id: "it", label: "Italy",       type: "image", category: "Flags", bodyColor: "#009246", imageUrl: "/img/skins/flags/it.svg" },
    { id: "es", label: "Spain",       type: "image", category: "Flags", bodyColor: "#aa151b", imageUrl: "/img/skins/flags/es.svg" },
    { id: "ru", label: "Russia",      type: "image", category: "Flags", bodyColor: "#ffffff", imageUrl: "/img/skins/flags/ru.svg" },
    { id: "jp", label: "Japan",       type: "image", category: "Flags", bodyColor: "#ffffff", imageUrl: "/img/skins/flags/jp.svg" },
    { id: "cn", label: "China",       type: "image", category: "Flags", bodyColor: "#ee1c25", imageUrl: "/img/skins/flags/cn.svg" },
    { id: "br", label: "Brazil",      type: "image", category: "Flags", bodyColor: "#009b3a", imageUrl: "/img/skins/flags/br.svg" },
    { id: "ca", label: "Canada",      type: "image", category: "Flags", bodyColor: "#ff0000", imageUrl: "/img/skins/flags/ca.svg" },
    { id: "tr", label: "Turkey",      type: "image", category: "Flags", bodyColor: "#e30a17", imageUrl: "/img/skins/flags/tr.svg" },



];

export function getSkinById(id: string): SkinDefinition {
    return SkinsRegistry.find(s => s.id === id) || SkinsRegistry[0];
}
