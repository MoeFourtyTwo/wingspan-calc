<script lang="ts">
    import { slide } from "svelte/transition";
    import { t } from "../i18n";
    import { ms, swoop } from "../ui/motion";
    import { parseRoomCode } from "./protocol";
    import { customLabel, hostView, joinRoom, onlinePhones, openShare } from "./ui";

    interface Props {
        /** Players in the nest; hosting needs at least one. */
        playerCount: number;
    }

    let { playerCount }: Props = $props();

    let code = $state("");
    let invalid = $state(false);
    let joinOpen = $state(false);
    const inputId = `join-code-${Math.random().toString(36).slice(2, 8)}`;

    function join(e: SubmitEvent) {
        e.preventDefault();
        const room = parseRoomCode(code);
        invalid = !room;
        if (room) void joinRoom(room, customLabel() || $t("guestDefaultLabel"));
    }
</script>

<section class="card collab" in:swoop={{ y: 18, delay: 100 }}>
    {#if playerCount > 0}
        <div class="host" transition:slide|local={{ duration: ms(220) }}>
            <div class="host-head">
                <span class="phones-art" aria-hidden="true">
                    <svg width="46" height="40" viewBox="0 0 46 40" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="8" width="16" height="28" rx="4" fill="#fffaf0" stroke="#2f7d6d" stroke-width="2.4" transform="rotate(-10 11 22)" />
                        <rect x="27" y="4" width="16" height="28" rx="4" fill="#fffaf0" stroke="#3b7fb6" stroke-width="2.4" transform="rotate(8 35 18)" />
                        <path class="wave" d="M19 14q4-5 8 0" stroke="#d9a72b" stroke-width="2.4" />
                        <path class="wave w2" d="M17 9q6-7 12 0" stroke="#d9a72b" stroke-width="2.4" />
                    </svg>
                </span>
                <div>
                    <h3 class="section-title">{$t("collabTitle")}</h3>
                    <p class="intro">{$t("collabIntro")}</p>
                </div>
            </div>
            {#if $hostView}
                <button class="btn-secondary connect live" onclick={openShare} aria-haspopup="dialog">
                    <span class="dot" aria-hidden="true"></span>
                    <span class="connect-text">
                        <span>{$t("collabShowCode")}</span>
                        <small>
                            {$onlinePhones === 0
                                ? $t("collabPhonesNone")
                                : $onlinePhones === 1
                                  ? $t("collabPhones_one")
                                  : $t("collabPhones", { n: $onlinePhones })}
                        </small>
                    </span>
                    <span class="room">{$hostView.room}</span>
                </button>
            {:else}
                <button class="btn-secondary connect" onclick={openShare} aria-haspopup="dialog">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v.01M14 21h7v-4" /></svg>
                    {$t("collabConnect")}
                </button>
            {/if}
        </div>
    {/if}

    {#if !$hostView}
        <div class="join" class:alone={playerCount === 0}>
            <button
                class="join-toggle"
                aria-expanded={joinOpen}
                aria-controls="{inputId}-form"
                onclick={() => (joinOpen = !joinOpen)}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg>
                <span class="join-title">{$t("collabJoinTitle")}</span>
                <svg class="chev" class:open={joinOpen} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {#if joinOpen}
                <form id="{inputId}-form" class="join-form" onsubmit={join} transition:slide|local={{ duration: ms(220) }}>
                    <label class="join-hint" for={inputId}>{$t("collabJoinHint")}</label>
                    <div class="join-row">
                        <input
                            id={inputId}
                            class="code-input"
                            class:invalid
                            bind:value={code}
                            oninput={() => (invalid = false)}
                            placeholder="K7PW3M"
                            maxlength="7"
                            autocomplete="off"
                            autocapitalize="characters"
                            spellcheck="false"
                            enterkeyhint="go"
                            aria-invalid={invalid}
                            aria-describedby={invalid ? `${inputId}-err` : undefined}
                        />
                        <button class="btn-primary join-btn" type="submit" disabled={code.trim().length < 6}>
                            {$t("collabJoinBtn")}
                        </button>
                    </div>
                    {#if invalid}
                        <p id="{inputId}-err" class="err" role="alert">{$t("collabJoinInvalid")}</p>
                    {/if}
                </form>
            {/if}
        </div>
    {/if}
</section>

<style>
    .collab {
        margin-bottom: 18px;
        padding: 16px;
    }

    .host-head {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 12px;
    }

    .host-head .section-title {
        margin-bottom: 2px;
    }

    .phones-art {
        flex-shrink: 0;
        padding-top: 2px;
    }

    .wave {
        animation: blink 1.8s ease-in-out infinite;
    }

    .wave.w2 {
        animation-delay: 0.3s;
    }

    @keyframes blink {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 1;
        }
    }

    .intro {
        font-size: 0.92rem;
        color: var(--ink-soft);
        line-height: 1.35;
    }

    .connect {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 52px;
        font-size: 1.05rem;
    }

    .connect.live {
        justify-content: flex-start;
        text-align: left;
        border-color: color-mix(in srgb, var(--forest) 45%, transparent);
        background: #eef7f3;
    }

    .connect-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
    }

    .connect-text small {
        font-family: var(--font-body);
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--ink-soft);
    }

    .room {
        font-family: var(--font-display);
        letter-spacing: 0.12em;
        color: var(--forest-deep);
    }

    .dot {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #3fae6a;
        box-shadow: 0 0 0 4px rgba(63, 174, 106, 0.2);
    }

    .join {
        margin-top: 12px;
        padding-top: 4px;
        border-top: 1.5px dashed var(--line);
    }

    .join.alone {
        margin-top: -6px;
        border-top: none;
    }

    .join-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        padding: 6px 2px;
        color: var(--ink-soft);
        font-weight: 800;
        text-align: left;
    }

    .join-title {
        flex: 1;
    }

    .chev {
        transition: transform 0.3s var(--spring);
    }

    .chev.open {
        transform: rotate(180deg);
    }

    .join-hint {
        display: block;
        font-size: 0.88rem;
        color: var(--ink-soft);
        margin-bottom: 8px;
    }

    .join-row {
        display: flex;
        gap: 8px;
    }

    .code-input {
        flex: 1;
        min-width: 0;
        height: 50px;
        padding: 0 12px;
        font-family: var(--font-display);
        font-size: 1.4rem;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        text-align: center;
        border: 2px solid var(--line);
        border-radius: var(--radius-sm);
        background: #fff;
    }

    .code-input::placeholder {
        color: #c9bea8;
    }

    .code-input:focus {
        outline: none;
        border-color: var(--forest);
        box-shadow: 0 0 0 4px rgba(47, 125, 109, 0.15);
    }

    .code-input.invalid {
        border-color: var(--berry);
        animation: wiggle 0.4s ease;
    }

    .join-btn {
        flex-shrink: 0;
        width: auto;
        min-height: 50px;
        padding: 0 18px;
    }

    .err {
        margin-top: 6px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--berry);
    }
</style>
