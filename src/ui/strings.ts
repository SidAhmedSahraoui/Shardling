export interface Strings {
  appTitle: string;
  menu: {
    play: string;
    levels: string;
    settings: string;
    versionPrefix: string;
    credits: string;
  };
  hints: {
    move: string;
    jump: string;
    doubleJump: string;
    spaceKey: string;
  };
  settings: {
    title: string;
    volume: string;
    mute: string;
    reduceMotion: string;
    camSensitivity: string;
    language: string;
    back: string;
    on: string;
    off: string;
  };
  hud: {
    shards: string;
    time: string;
    deaths: string;
    pause: string;
  };
  pause: {
    title: string;
    resume: string;
    restart: string;
    quitToMenu: string;
  };
  levelSelect: {
    title: string;
    back: string;
    worldPrefix: string;
    worldNames: readonly string[];
    comingSoon: string;
    locked: string;
    best: string;
    deaths: string;
  };
  complete: {
    title: string;
    time: string;
    deaths: string;
    best: string;
    newBest: string;
    noBest: string;
    next: string;
    replay: string;
    levels: string;
  };
  orientation: {
    rotate: string;
  };
  touch: {
    move: string;
    jump: string;
  };
  debug: {
    panelTitle: string;
    folderMovement: string;
    folderCamera: string;
    folderPostFx: string;
    copyAsCode: string;
    hudFps: string;
    hudDrawCalls: string;
    hudTriangles: string;
    hudBodies: string;
    hudGeometries: string;
    hudState: string;
    hudFreeFly: string;
    hudOn: string;
    hudOff: string;
    hudNone: string;
  };
  levelNames: Record<string, string>;
}

export const en: Strings = {
  appTitle: "Shardling",
  menu: {
    play: "Play",
    levels: "Levels",
    settings: "Settings",
    versionPrefix: "v",
    credits: "Made by Sid Ahmed Sahraoui",
  },
  hints: {
    move: "Move",
    jump: "Jump",
    doubleJump: "Jump again in the air",
    spaceKey: "Space",
  },
  settings: {
    title: "Settings",
    volume: "Volume",
    mute: "Mute",
    reduceMotion: "Reduce motion",
    camSensitivity: "Camera sensitivity",
    language: "Language",
    back: "Back",
    on: "On",
    off: "Off",
  },
  hud: {
    shards: "Shards",
    time: "Time",
    deaths: "Deaths",
    pause: "Pause",
  },
  pause: {
    title: "Paused",
    resume: "Resume",
    restart: "Restart level",
    quitToMenu: "Back to menu",
  },
  levelSelect: {
    title: "Levels",
    back: "Back",
    worldPrefix: "World ",
    worldNames: ["Emberfall", "The Gears", "Updraft", "The Hollow Heart"],
    comingSoon: "Coming soon",
    locked: "Locked",
    best: "Best",
    deaths: "Deaths",
  },
  complete: {
    title: "Level complete",
    time: "Time",
    deaths: "Deaths",
    best: "Best",
    newBest: "New best!",
    noBest: "—",
    next: "Next level",
    replay: "Replay",
    levels: "Levels",
  },
  orientation: {
    rotate: "Rotate your device to play",
  },
  touch: {
    move: "Move",
    jump: "Jump",
  },
  debug: {
    panelTitle: "Tuning",
    folderMovement: "Movement",
    folderCamera: "Camera",
    folderPostFx: "PostFX (applies on reload)",
    copyAsCode: "Copy as code",
    hudFps: "fps",
    hudDrawCalls: "draw",
    hudTriangles: "tris",
    hudBodies: "bodies",
    hudGeometries: "geoms",
    hudState: "state",
    hudFreeFly: "fly [F]",
    hudOn: "on",
    hudOff: "off",
    hudNone: "—",
  },
  levelNames: {},
};

export let strings: Strings = en;

export function setActiveStrings(next: Strings): void {
  strings = next;
}
