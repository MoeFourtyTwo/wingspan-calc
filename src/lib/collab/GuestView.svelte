<script lang="ts">
    import { gameStore } from "../store";
    import { t } from "../i18n";
    import Result from "../Result.svelte";
    import Bird from "../ui/Bird.svelte";
    import { pop, swoop } from "../ui/motion";
    import GuestPicker from "./GuestPicker.svelte";
    import GuestScoring from "./GuestScoring.svelte";
    import { joined } from "./session";
    import { customLabel, guestView, joinRoom, leaveRoom, setCustomLabel } from "./ui";

    const SLOW_MS = 15000;

    let guest = $derived($joined);
    let view = $derived($guestView);
    let status = $derived(view?.status ?? "connecting");
    let room = $derived(view?.room ?? "");
    let phase = $derived($gameStore.currentPhase);
    let players = $derived($gameStore.players);
    let mine = $derived(view ? players.filter((p) => view.claims[p.id] === view.deviceId) : []);

    // Until the host answered once, the store still shows this phone's own game.
    let seenHost: object | null = $state.raw(null);
    $effect(() => {
        if (status === "connected" && guest) seenHost = guest;
    });
    let everConnected = $derived(!!guest && seenHost === guest);

    // No answer for a while: probably a wrong code or a network that blocks it.
    let slow = $state(false);
    $effect(() => {
        slow = false;
        if (status !== "connecting" || !guest) return;
        const id = setTimeout(() => (slow = true), SLOW_MS);
        return () => clearTimeout(id);
    });

    // ---- This phone's name: custom, or named after its players ----
    let custom = $state(customLabel());
    let autoLabel = $derived(
        mine.length > 0
            ? $t("guestLabelOf", { names: mine.map((p) => p.name).join(" & ") })
            : $t("guestDefaultLabel"),
    );
    let label = $derived(custom.trim() || autoLabel);
    $effect(() => {
        if (status === "connected") guest?.setLabel(label);
    });

    function saveLabel(value: string) {
        custom = value.trim();
        setCustomLabel(custom);
    }

    function claim(ids: string[]) {
        guest?.claim(ids);
    }

    function retry() {
        if (room) void joinRoom(room, label);
    }

    function leave() {
        if (status === "ended" || !everConnected || confirm($t("guestLeaveConfirm"))) leaveRoom();
    }

    let group = $derived(
        phase === "SCORING" ? "scoring" : phase === "RESULT" || phase === "STATS" ? "result" : "lobby",
    );
    let statusText = $derived(
        status === "ended"
            ? $t("guestEnded")
            : status === "connected"
              ? $t("guestConnected")
              : everConnected
                ? $t("guestReconnecting")
                : $t("guestConnecting"),
    );
</script>

<div class="guest screen">
    <div class="status-bar" class:connected={status === "connected"} class:ended={status === "ended"}>
        <span class="status-icon" aria-hidden="true">
            {#if status === "connecting"}
                <span class="mini-bird"><Bird size={26} flapping /></span>
            {:else}
                <span class="dot"></span>
            {/if}
        </span>
        <span class="status-text" role="status" aria-live="polite">{statusText}</span>
        <span class="room-chip" aria-label="{$t('guestRoom')} {[...room].join(' ')}">
            <small aria-hidden="true">{$t("guestRoom")}</small>
            <span aria-hidden="true">{room}</span>
        </span>
        <button class="icon-btn leave" onclick={leave} aria-label={$t("guestLeave")} title={$t("guestLeave")}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5M20 12H9" /><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" /></svg>
        </button>
    </div>

    {#if !everConnected}
        <section class="connecting" in:pop={{ duration: 420, start: 0.7 }}>
            <span class="flyer" aria-hidden="true"><Bird size={72} flapping /></span>
            <h2>{$t("guestConnectingTitle", { code: room })}</h2>
            {#if slow}
                <div class="slow" in:swoop={{ y: 10, duration: 320 }}>
                    <p role="alert">{$t("guestSlowHint")}</p>
                    <button class="btn-primary" onclick={retry}>{$t("guestRetry")}</button>
                    <button class="btn-ghost" onclick={leaveRoom}>{$t("guestCancel")}</button>
                </div>
            {/if}
        </section>
    {:else}
        {#if status === "ended"}
            <section class="card ended-card" in:pop={{ duration: 380, start: 0.8 }}>
                <h2>{$t("guestEnded")}</h2>
                <p>{$t("guestEndedHint")}</p>
                <button class="btn-primary" onclick={leaveRoom}>{$t("guestLeave")}</button>
            </section>
        {/if}

        <div class="body" inert={status === "ended"}>
            {#key group}
                <div in:swoop={{ x: 40, y: 6, rotate: 1.5, duration: 420 }}>
                    {#if group === "lobby"}
                        <section class="card taped lobby">
                            <h2 class="section-title">{$t("guestWho")}</h2>
                            <p class="lobby-hint">{$t("guestWhoHint")}</p>
                            {#if view}
                                <GuestPicker {players} claims={view.claims} devices={view.devices} myId={view.deviceId} onchange={claim} />
                            {/if}
                            <label class="phone-name">
                                <span>{$t("guestPhoneName")}</span>
                                <input
                                    type="text"
                                    maxlength="40"
                                    value={custom}
                                    placeholder={autoLabel}
                                    onchange={(e) => saveLabel(e.currentTarget.value)}
                                    onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                />
                            </label>
                        </section>

                        <div class="waiting">
                            <svg class="twig" viewBox="0 0 160 20" aria-hidden="true">
                                <path d="M4 12 Q80 4 156 11" stroke="#8a6142" stroke-width="3" fill="none" stroke-linecap="round" />
                                <path d="M120 9 q8 -8 16 -5 q-6 5 -16 5z" fill="#2f7d6d" />
                            </svg>
                            <span class="perched" aria-hidden="true"><Bird size={44} /></span>
                            <p class="hand">{$t("guestWaiting")}</p>
                            <p class="waiting-hint">{$t("guestWaitingHint")}</p>
                        </div>
                    {:else if group === "scoring" && view}
                        <GuestScoring {view} onclaim={claim} />
                    {:else if group === "result"}
                        <Result spectator onleave={leaveRoom} canEditFood={(id) => mine.some((p) => p.id === id)} />
                    {/if}
                </div>
            {/key}
        </div>
    {/if}
</div>

<style>
    .guest {
        flex: 1;
        gap: 14px;
    }

    /* ---------- Status bar ---------- */
    .status-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 4px 4px 12px;
        border-radius: 999px;
        background: var(--card);
        border: 1.5px solid var(--line);
        box-shadow: var(--shadow-sm);
    }

    .status-bar.connected {
        border-color: color-mix(in srgb, var(--forest) 40%, transparent);
    }

    .status-bar.ended {
        border-color: color-mix(in srgb, var(--berry) 40%, transparent);
        background: #fff6f3;
    }

    .status-icon {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 26px;
    }

    .mini-bird {
        display: block;
        animation: bob 1.2s ease-in-out infinite;
    }

    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #3fae6a;
        box-shadow: 0 0 0 4px rgba(63, 174, 106, 0.2);
    }

    .ended .dot {
        background: var(--berry);
        box-shadow: 0 0 0 4px rgba(194, 85, 74, 0.18);
    }

    .status-text {
        flex: 1;
        min-width: 0;
        font-size: 0.9rem;
        font-weight: 800;
        line-height: 1.2;
    }

    .room-chip {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1;
        font-family: var(--font-display);
        font-size: 1.05rem;
        letter-spacing: 0.1em;
        color: var(--forest-deep);
    }

    .room-chip small {
        font-family: var(--font-body);
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-soft);
    }

    .leave {
        flex-shrink: 0;
    }

    .leave:hover {
        color: var(--berry);
    }

    /* ---------- Connecting ---------- */
    .connecting {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 40px 12px;
        text-align: center;
    }

    .connecting h2 {
        font-size: 1.4rem;
    }

    .flyer {
        animation: fly 2.4s ease-in-out infinite;
    }

    @keyframes fly {
        0%,
        100% {
            transform: translate(-14px, 0) rotate(-4deg);
        }
        50% {
            transform: translate(14px, -12px) rotate(4deg);
        }
    }

    .slow {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        width: 100%;
        max-width: 320px;
        margin-top: 6px;
    }

    .slow p {
        font-weight: 700;
        color: var(--ink-soft);
    }

    /* ---------- Ended ---------- */
    .ended-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-color: color-mix(in srgb, var(--berry) 35%, transparent);
    }

    .ended-card h2 {
        font-size: 1.25rem;
    }

    .ended-card p {
        font-size: 0.92rem;
        color: var(--ink-soft);
    }

    .body[inert] {
        opacity: 0.55;
        filter: saturate(0.6);
    }

    /* ---------- Lobby ---------- */
    .lobby .section-title {
        margin-bottom: 2px;
    }

    .lobby-hint {
        font-size: 0.92rem;
        color: var(--ink-soft);
        margin-bottom: 12px;
    }

    .phone-name {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 14px;
        font-size: 0.85rem;
        font-weight: 800;
        color: var(--ink-soft);
    }

    .phone-name input {
        min-height: 44px;
        padding: 8px 12px;
        font-size: 1rem;
        font-weight: 600;
        color: var(--ink);
        border: 2px solid var(--line);
        border-radius: var(--radius-sm);
        background: #fff;
    }

    .phone-name input:focus {
        outline: none;
        border-color: var(--forest);
        box-shadow: 0 0 0 4px rgba(47, 125, 109, 0.15);
    }

    .waiting {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 22px;
        text-align: center;
    }

    .twig {
        width: 160px;
        height: 20px;
        order: 1;
        margin-top: -12px;
    }

    .perched {
        order: 0;
        animation: bob 2s ease-in-out infinite;
    }

    .waiting .hand {
        order: 2;
        font-size: 1.6rem;
        color: var(--ink-soft);
        margin-top: 4px;
    }

    .waiting-hint {
        order: 3;
        font-size: 0.88rem;
        color: var(--ink-soft);
        max-width: 300px;
    }
</style>
