(function(Scratch) {
    "use strict";

    if (!Scratch.extensions.unsandboxed) {
        throw new Error("TACT-AIM Kill Effect must be run unsandboxed.");
    }

    const vm = Scratch.vm;
    const runtime = vm?.runtime;
    const renderer = vm?.renderer;
    const installed = Symbol.for("tactAim.killEffectPen");
    if (!runtime?.on || typeof renderer?.createPenSkin !== "function" || runtime[installed]) return;

    const penMethods = Object.getPrototypeOf(renderer);
    const clearPen = penMethods.penClear ?? renderer.penClear;
    const drawLine = penMethods.penLine ?? renderer.penLine;
    const referenceFps = 30;
    const initialSpeed = 72;
    const damping = 0.9;
    const bounceFrames = Math.ceil(Math.log(1 / initialSpeed) / Math.log(damping));
    const sweepStep = 50;

    const letters = [
        {x: -118, strokes: [[0, -29, 0, 29], [3, 0, 42, 27], [3, 0, 42, -27]]},
        {x: -43, strokes: [[0, -29, 0, 29], [-8, 29, 8, 29], [-8, -29, 8, -29]]},
        {x: 14, strokes: [[0, 29, 0, -29], [0, -29, 43, -29]]},
        {x: 82, strokes: [[0, 29, 0, -29], [0, -29, 39, -29]]},
    ];
    const yellow = [1, 0.95, 0.025, 1];
    const letteringPen = {diameter: 20, color4f: yellow};
    const sweepPen = {diameter: 96, color4f: [...yellow]};

    let skin;
    let stage;
    let counter;
    let menu;
    let previous;
    let startTime;
    let lastTick = -1;

    function clearEffect() {
        if (startTime !== undefined && skin !== undefined) {
            clearPen.call(renderer, skin);
            runtime.requestRedraw();
        }
        startTime = undefined;
        lastTick = -1;
    }

    function draw(now) {
        const tick = Math.floor(Math.max(0, now - startTime) * referenceFps / 1000);
        if (tick === lastTick) return;

        const sweepDistance = Math.max(0, tick - bounceFrames + 1) * sweepStep;
        if (sweepDistance > 2700) {
            clearEffect();
            return;
        }
        if (skin === undefined) {
            const drawable = renderer.createDrawable("pen");
            if (drawable === undefined) {
                clearEffect();
                return;
            }
            skin = renderer.createPenSkin();
            renderer.markDrawableAsNoninteractive?.(drawable);
            renderer.updateDrawableSkinId(drawable, skin);
        }
        lastTick = tick;
        clearPen.call(renderer, skin);

        const [width, height] = renderer.getNativeSize();
        const scale = Math.min(width / 480, height / 360);
        const centerY = height * 0.28;
        if (sweepDistance - sweepStep < 240) {
            const angle = initialSpeed * (1 - damping ** Math.min(tick, bounceFrames)) / (1 - damping);
            const stretch = Math.cos(angle * Math.PI / 180);
            letteringPen.diameter = 20 * scale;
            for (const {x, strokes} of letters) {
                for (const [x0, y0, x1, y1] of strokes) {
                    drawLine.call(renderer, skin, letteringPen,
                        (x + x0) * scale, centerY + y0 * scale * stretch,
                        (x + x1) * scale, centerY + y1 * scale * stretch);
                }
            }
        }

        if (sweepDistance > 0) {
            const left = -width / 2;
            const tip = left + Math.min(520, sweepDistance) * width / 480;
            sweepPen.diameter = 96 * scale;
            sweepPen.color4f[3] = 1 - Math.max(0, sweepDistance - 200) / 2500;
            drawLine.call(renderer, skin, sweepPen, left, centerY, tip, centerY);
        }
        runtime.requestRedraw();
    }

    function reset() {
        clearEffect();
        previous = undefined;
    }

    function observe() {
        const currentStage = runtime.getTargetForStage?.();
        if (currentStage !== stage) {
            reset();
            stage = currentStage;
            const variables = Object.values(stage?.variables ?? {});
            counter = variables.find(variable => variable.name === "Kill counter" && !variable.type);
            menu = variables.find(variable => variable.name === "Menu" && variable.type === "list");
        }

        const count = Number(counter?.value);
        if (Number(menu?.value?.[49]) !== 2 || !Number.isSafeInteger(count) || count < 0) {
            if (previous !== undefined) reset();
            return;
        }
        const gained = previous !== undefined && count > previous;
        previous = count;
        const now = performance.now();
        if (gained && !document.hidden) {
            startTime = now;
            lastTick = -1;
        }
        if (startTime !== undefined) draw(now);
    }

    runtime[installed] = true;
    runtime.on("AFTER_EXECUTE", observe);
    runtime.on("PROJECT_STOP_ALL", reset);
    runtime.on("PROJECT_START", reset);
    observe();

    class TactAimKillEffect {
        getInfo() {
            return {
                id: "tactAimKillEffect",
                name: "TACT-AIM Kill Effect",
                blocks: []
            };
        }
    }
    Scratch.extensions.register(new TactAimKillEffect());
})(Scratch);
