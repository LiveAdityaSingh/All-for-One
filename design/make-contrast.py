# Before/after artboards for the two measured contrast failures. Both boards
# render the identical slice; only the three colour values differ, so any
# visible difference is the fix doing its work.

TEMPLATE = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap">
  <style>
    body {{ margin: 0; }}
    a {{ color: oklch(0.62 0.13 75); }}
    a:hover {{ color: oklch(0.70 0.13 75); }}
    * {{ box-sizing: border-box; }}
  </style>
</helmet>

<div style="position: relative; width: 412px; min-height: 760px; background: oklch(0.155 0.010 268); color: oklch(0.93 0.008 268); font-family: Geist, system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; overflow: hidden;">
  <div style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 62% at 50% -8%, oklch(0.30 0.035 268) 0%, transparent 62%);"></div>

  <div style="position: relative; display: flex; flex-direction: column; gap: 16px; padding: 22px 16px;">

    <div>
      <div style="font-size: 20px; font-weight: 600;">{TITLE}</div>
      <div style="font-size: 12px; color: oklch(0.68 0.008 268);">{SUBTITLE}</div>
    </div>

    <!-- 1. Overdue text: the most consequential words on the screen -->
    <div style="display: flex; flex-direction: column; gap: 8px; border: 1px solid oklch(0.28 0.012 268); border-radius: 12px; padding: 12px; background: oklch(0.205 0.010 268); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">
      <div style="font-size: 10px; letter-spacing: 0.1em; color: oklch(0.68 0.008 268);">OVERDUE TEXT · 12px</div>
      <div>
        <div style="font-size: 15px; font-weight: 600;">Monzo</div>
        <div style="font-size: 12px; color: oklch(0.68 0.008 268);">Senior Backend Engineer</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px;">
          <span style="width: 7px; height: 7px; border-radius: 9999px; background: {OVERDUE}; box-shadow: 0 0 10px {OVERDUE};"></span>
          <span style="font-size: 12px; color: {OVERDUE};">Overdue by 3 days</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="border-radius: 9999px; padding: 2px 8px; font-size: 11px; font-weight: 600; background: {BADGE_BG}; color: {BADGE_FG};">{RATIO_OVERDUE}</span>
        <span style="font-size: 11px; color: oklch(0.68 0.008 268);">{VERDICT_OVERDUE}</span>
      </div>
    </div>

    <!-- 2. The stale row: colour deliberately drained -->
    <div style="display: flex; flex-direction: column; gap: 8px; border: 1px solid oklch(0.24 0.006 268); border-radius: 12px; padding: 12px; background: oklch(0.18 0.005 268);">
      <div style="font-size: 10px; letter-spacing: 0.1em; color: oklch(0.68 0.008 268);">STALE ROW · ghosting decay</div>
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
        <div>
          <div style="font-size: 15px; font-weight: 600; color: {STALE};">Initech</div>
          <div style="font-size: 12px; color: {STALE};">ML Engineer &middot; applied 24 days ago</div>
        </div>
        <div style="flex-shrink: 0; border-radius: 9999px; padding: 4px 10px; font-size: 11px; background: oklch(0.26 0 70); color: oklch(0.68 0.008 268);">Any news on this?</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="border-radius: 9999px; padding: 2px 8px; font-size: 11px; font-weight: 600; background: {BADGE_BG}; color: {BADGE_FG};">{RATIO_STALE}</span>
        <span style="font-size: 11px; color: oklch(0.68 0.008 268);">{VERDICT_STALE}</span>
      </div>
    </div>

    <!-- 3. The destructive button, where overdue is a BACKGROUND -->
    <div style="display: flex; flex-direction: column; gap: 10px; border: 1px solid oklch(0.28 0.012 268); border-radius: 12px; padding: 12px; background: oklch(0.205 0.010 268); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">
      <div style="font-size: 10px; letter-spacing: 0.1em; color: oklch(0.68 0.008 268);">DESTRUCTIVE BUTTON · label on fill</div>
      <div style="font-size: 12px; color: oklch(0.68 0.008 268);">
        This will replace everything on this device.
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="border-radius: 9999px; padding: 8px 16px; font-size: 13px; font-weight: 500; background: {OVERDUE}; color: {BTN_TEXT};">Replace my data</div>
        <div style="border-radius: 9999px; padding: 8px 16px; font-size: 13px; border: 1px solid oklch(0.28 0.012 268);">Cancel</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="border-radius: 9999px; padding: 2px 8px; font-size: 11px; font-weight: 600; background: {BADGE_BG}; color: {BADGE_FG};">{RATIO_BUTTON}</span>
        <span style="font-size: 11px; color: oklch(0.68 0.008 268);">{VERDICT_BUTTON}</span>
      </div>
    </div>

    <!-- 4. Severity next to Marco's coral: identity must never be confusable -->
    <div style="display: flex; flex-direction: column; gap: 10px; border: 1px solid oklch(0.28 0.012 268); border-radius: 12px; padding: 12px; background: oklch(0.205 0.010 268); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">
      <div style="font-size: 10px; letter-spacing: 0.1em; color: oklch(0.68 0.008 268);">SEVERITY vs MARCO&rsquo;S IDENTITY</div>
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 7px;">
          <span style="width: 22px; height: 22px; border-radius: 6px; background: {OVERDUE};"></span>
          <span style="font-size: 12px;">Overdue</span>
        </div>
        <div style="display: flex; align-items: center; gap: 7px;">
          <span style="width: 22px; height: 22px; border-radius: 6px; background: oklch(0.62 0.13 15);"></span>
          <span style="font-size: 12px;">Marco</span>
        </div>
        <span style="font-size: 11px; color: oklch(0.68 0.008 268);">{DELTA_E}</span>
      </div>
      <div style="font-size: 11px; color: oklch(0.68 0.008 268);">
        Never relied on alone: severity is always a dot plus explicit words.
      </div>
    </div>

  </div>
</div>
</x-dc>
</body>
</html>
"""

PASS_BG = "color-mix(in oklch, oklch(0.72 0.16 155) 20%, transparent)"
PASS_FG = "oklch(0.78 0.16 155)"
FAIL_BG = "color-mix(in oklch, oklch(0.6 0.19 25) 22%, transparent)"
FAIL_FG = "oklch(0.72 0.19 25)"

BOARDS = {
    "ContrastNow": dict(
        TITLE="Now", SUBTITLE="What is shipping today",
        OVERDUE="oklch(0.6 0.19 25)",
        STALE="oklch(0.55 0 70)",
        BTN_TEXT="oklch(0.93 0.008 268)",
        BADGE_BG=FAIL_BG, BADGE_FG=FAIL_FG,
        RATIO_OVERDUE="4.13", VERDICT_OVERDUE="below AA (needs 4.5)",
        RATIO_STALE="3.69", VERDICT_STALE="below AA — the worst on the screen",
        RATIO_BUTTON="3.53", VERDICT_BUTTON="light label on red, below AA",
        DELTA_E="ΔE 10.5 apart",
    ),
    "ContrastFixed": dict(
        TITLE="Proposed", SUBTITLE="Lightness up, hue nudged, labels flipped",
        OVERDUE="oklch(0.68 0.19 30)",
        STALE="oklch(0.62 0 0)",
        BTN_TEXT="oklch(0.155 0.010 268)",
        BADGE_BG=PASS_BG, BADGE_FG=PASS_FG,
        RATIO_OVERDUE="5.70", VERDICT_OVERDUE="passes AA, with headroom",
        RATIO_STALE="4.92", VERDICT_STALE="passes AA, still colourless",
        RATIO_BUTTON="6.22", VERDICT_BUTTON="dark label on red, passes AA",
        DELTA_E="ΔE 14.0 apart",
    ),
}

for name, values in BOARDS.items():
    with open(name + ".dc.html", "w", encoding="utf-8") as handle:
        handle.write(TEMPLATE.format(**values))
    print("wrote", name)
