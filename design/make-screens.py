# Emits all five agent artboards from ONE token set, so the chosen ground
# treatment (option E: cool slate, refined) cannot drift between screens.
# Re-run this after changing TOKENS and every screen updates together.
import math

T = {
    "bg": "oklch(0.155 0.010 268)",
    "elev": "oklch(0.205 0.010 268)",
    "border": "oklch(0.28 0.012 268)",
    "fg": "oklch(0.93 0.008 268)",
    "muted": "oklch(0.68 0.008 268)",
    "stale_bg": "oklch(0.18 0.005 268)",
    "stale_border": "oklch(0.24 0.006 268)",
    "stale_fg": "oklch(0.55 0 70)",
    "overdue": "oklch(0.6 0.19 25)",
    # One soft source at the top; cards catch it on a 1px edge.
    "ambient": "radial-gradient(120% 62% at 50% -8%, oklch(0.30 0.035 268) 0%, transparent 62%)",
    "lip": "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
}

HUE = {"tony": 75, "lisa": 250, "jarvis": 155, "vanessa": 300, "marco": 15}
NAME = {"tony": "Tony", "lisa": "Lisa", "jarvis": "Jarvis",
        "vanessa": "Vanessa", "marco": "Marco"}


def c(agent, chroma=0.13, light=0.62):
    return f"oklch({light} {chroma} {HUE[agent]})"


def mix(agent, pct, onto="transparent"):
    return f"color-mix(in oklch, {c(agent)} {pct}%, {onto})"


def card(extra=""):
    return (f"border: 1px solid {T['border']}; border-radius: 12px; padding: 12px; "
            f"background: {T['elev']}; box-shadow: {T['lip']};{extra}")


ICONS = {
    "tony": '<rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M2 13h20" />',
    "lisa": '<rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />',
    "jarvis": '<circle cx="12" cy="12" r="2.2" /><ellipse cx="12" cy="12" rx="10" ry="4.5" /><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)" />',
    "vanessa": '<path d="M19 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0 0 4h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5" /><circle cx="17" cy="13" r="1.2" />',
    "marco": '<path d="M19 14c1.5-1.6 2-3 2-4.7A4.8 4.8 0 0 0 12 6.5 4.8 4.8 0 0 0 3 9.3c0 1.7.5 3.1 2 4.7l7 7z" /><path d="M3.5 12h4l1.5-3 2 5 1.5-2h6" />',
}


def tab_bar(active):
    cells = []
    for key in ["tony", "lisa", "jarvis", "vanessa", "marco"]:
        on = key == active
        glow = (f' style="filter: drop-shadow(0 0 7px {mix(key, 70)});"') if on else ""
        dot = (f'<span style="width: 4px; height: 4px; border-radius: 9999px; '
               f'background: {c(key)};"></span>') if on else '<span style="width: 4px; height: 4px;"></span>'
        cells.append(
            f'<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; '
            f'gap: 4px; padding: 12px 0 10px 0;">'
            f'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{c(key)}" '
            f'stroke-width="{2.4 if on else 2}" stroke-linecap="round" stroke-linejoin="round"{glow}>'
            f'{ICONS[key]}</svg>'
            f'<span style="font-size: 14px; {"font-weight: 600; " if on else ""}color: {c(key)};">{NAME[key]}</span>'
            f'{dot}</div>')
    return (f'<div style="position: relative; display: flex; align-items: stretch; '
            f'border-top: 1px solid {T["border"]}; background: oklch(0.185 0.010 268); '
            f'box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);">{"".join(cells)}</div>')


def input_bar(placeholder, jarvis_dot=True):
    dot = (f'<span style="width: 9px; height: 9px; border-radius: 9999px; background: {c("jarvis")}; '
           f'flex-shrink: 0; box-shadow: 0 0 10px {mix("jarvis", 80)};"></span>') if jarvis_dot else ""
    return (f'<div style="position: relative; display: flex; align-items: center; gap: 8px; '
            f'padding: 0 16px 12px 16px;">'
            f'<div style="flex-grow: 1; border: 1px solid {T["border"]}; border-radius: 9999px; '
            f'background: {T["elev"]}; padding: 11px 16px; font-size: 14px; color: {T["muted"]}; '
            f'box-shadow: {T["lip"]};">{placeholder}</div>'
            f'<div style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 9999px; '
            f'background: {c("jarvis", 0.052)}; display: flex; align-items: center; justify-content: center; '
            f'box-shadow: 0 0 18px -6px {mix("jarvis", 80)};">'
            f'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="{T["bg"]}" stroke-width="2" '
            f'stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3" />'
            f'<path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 19v3" /></svg></div>{dot}</div>')


def header(agent, subtitle, action=None):
    right = ""
    if action:
        right = (f'<div style="display: flex; align-items: center; gap: 6px; '
                 f'border: 1px solid {c(agent, 0.052)}; border-radius: 9999px; padding: 7px 14px; '
                 f'color: {c(agent)}; font-size: 14px;">'
                 f'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                 f'stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>{action}</div>')
    return (f'<div style="padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">'
            f'<div><div style="font-size: 24px; font-weight: 600; color: {c(agent)}; line-height: 1.1; '
            f'text-shadow: 0 0 22px {mix(agent, 45)};">{NAME[agent]}</div>'
            f'<div style="font-size: 12px; color: {T["muted"]};">{subtitle}</div></div>{right}</div>')


def summary(cells):
    out = []
    for i, (label, value) in enumerate(cells):
        edge = (f"border-left: 1px solid {T['border']}; border-right: 1px solid {T['border']};"
                if i == 1 else "")
        out.append(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; '
                   f'padding: 0 8px; {edge}">'
                   f'<div style="font-size: 10px; letter-spacing: 0.08em; color: {T["muted"]};">{label}</div>'
                   f'<div style="font-size: 18px; font-weight: 600;">{value}</div></div>')
    return (f'<div style="margin: 0 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); '
            f'border: 1px solid {T["border"]}; border-radius: 16px; background: {T["elev"]}; padding: 12px 0; '
            f'box-shadow: {T["lip"]};">{"".join(out)}</div>')


def pulse(agent, label, headline, icon_path):
    """The one element allowed to actually glow."""
    return (f'<div style="margin: 0 16px; display: flex; align-items: center; gap: 12px; '
            f'border: 1px solid {mix(agent, 40)}; border-radius: 16px; padding: 16px; '
            f'background: color-mix(in oklch, {c(agent)} 9%, {T["elev"]}); '
            f'box-shadow: 0 0 34px -12px {mix(agent, 85)}, inset 0 1px 0 rgba(255, 255, 255, 0.06);">'
            f'<div style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: flex; '
            f'align-items: center; justify-content: center; background: {mix(agent, 22)}; '
            f'box-shadow: 0 0 18px -6px {mix(agent, 80)};">'
            f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{c(agent)}" '
            f'stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">{icon_path}</svg></div>'
            f'<div style="min-width: 0; flex-grow: 1;">'
            f'<div style="font-size: 10px; font-weight: 500; letter-spacing: 0.14em; color: {T["muted"]};">{label}</div>'
            f'<div style="font-size: 14px; font-weight: 600; color: {c(agent)};">{headline}</div></div>'
            f'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="{T["muted"]}" stroke-width="2" '
            f'stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg></div>')


def chips(items):
    out = []
    for label, on in items:
        style = (f"border: 1px solid {c('lisa')}; color: {c('lisa')};" if on
                 else f"border: 1px solid {T['border']}; color: {T['fg']};")
        out.append(f'<div style="{style} border-radius: 9999px; padding: 8px 16px; font-size: 14px;">{label}</div>')
    return f'<div style="display: flex; gap: 8px; padding: 0 16px;">{"".join(out)}</div>'


def chips_for(agent, items):
    out = []
    for label, on in items:
        style = (f"border: 1px solid {c(agent)}; color: {c(agent)};" if on
                 else f"border: 1px solid {T['border']}; color: {T['fg']};")
        out.append(f'<div style="{style} border-radius: 9999px; padding: 8px 16px; font-size: 14px;">{label}</div>')
    return f'<div style="display: flex; gap: 8px; padding: 0 16px;">{"".join(out)}</div>'


SPARKLE = '<path d="M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6z" />'


def orb_svg():
    """Static stand-in for the live particle sphere, same emerald shell."""
    pts = []
    n = 260
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - (i / (n - 1)) * 2
        ring = math.sqrt(max(0.0, 1 - y * y))
        theta = golden * i
        x, z = math.cos(theta) * ring, math.sin(theta) * ring
        # Depth drives size and opacity, which is what reads as a sphere.
        depth = (z + 1) / 2
        r = 0.9 + depth * 1.9
        op = 0.22 + depth * 0.72
        pts.append(f'<circle cx="{100 + x * 78:.1f}" cy="{100 + y * 78:.1f}" r="{r:.2f}" '
                   f'fill="{c("jarvis", 0.13, 0.70)}" opacity="{op:.2f}" />')
    return (f'<svg width="200" height="200" viewBox="0 0 200 200" '
            f'style="filter: drop-shadow(0 0 26px {mix("jarvis", 45)});">{"".join(pts)}</svg>')


def page(agent, min_height, body, placeholder):
    return f"""<!doctype html>
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
    a {{ color: {c(agent)}; }}
    a:hover {{ color: {c(agent, 0.13, 0.70)}; }}
    * {{ box-sizing: border-box; }}
  </style>
</helmet>

<div style="position: relative; width: 412px; min-height: {min_height}px; background: {T['bg']}; color: {T['fg']}; font-family: Geist, system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; overflow: hidden;">
  <div style="position: absolute; inset: 0; pointer-events: none; background: {T['ambient']};"></div>
  <div style="position: relative; display: flex; flex-direction: column; gap: 16px; padding: 24px 0 16px 0; flex-grow: 1;">
{body}
  </div>
{input_bar(placeholder)}
{tab_bar(agent)}
</div>
</x-dc>
</body>
</html>
"""


# ---------------------------------------------------------------- Tony ----
def app_row(company, role, chip, extra_line="", stale=False, actions=True):
    if stale:
        return (f'<div style="display: flex; flex-direction: column; gap: 10px; '
                f'border: 1px solid {T["stale_border"]}; border-radius: 12px; padding: 12px; '
                f'background: {T["stale_bg"]};">'
                f'<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">'
                f'<div style="min-width: 0;"><div style="font-size: 15px; font-weight: 600; color: {T["stale_fg"]};">{company}</div>'
                f'<div style="font-size: 12px; color: {T["stale_fg"]};">{role}</div></div>'
                f'<div style="flex-shrink: 0; border-radius: 9999px; padding: 4px 10px; font-size: 11px; '
                f'font-weight: 500; background: oklch(0.26 0 70); color: {T["muted"]};">{chip}</div></div>'
                f'<div style="display: flex; align-items: center; gap: 8px;">'
                f'<div style="border-radius: 9999px; padding: 7px 14px; font-size: 12px; '
                f'border: 1px solid {T["border"]}; color: {T["fg"]};">Undo</div>'
                f'<div style="font-size: 11px; color: {T["stale_fg"]};">Moved to stale on its own</div></div></div>')

    return (f'<div style="{card()}display: flex; flex-direction: column; gap: 10px;">'
            f'<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">'
            f'<div style="min-width: 0;"><div style="font-size: 15px; font-weight: 600;">{company}</div>'
            f'<div style="font-size: 12px; color: {T["muted"]};">{role}</div>{extra_line}</div>'
            f'<div style="flex-shrink: 0; border-radius: 9999px; padding: 4px 10px; font-size: 11px; '
            f'font-weight: 500; background: {mix("tony", 18)}; color: {c("tony")};">{chip}</div></div>'
            f'<div style="display: flex; align-items: center; gap: 8px;">'
            f'<div style="border-radius: 9999px; padding: 7px 14px; font-size: 12px; font-weight: 500; '
            f'background: {c("tony", 0.052)}; color: {T["fg"]};">Advance</div>'
            f'<div style="border-radius: 9999px; padding: 7px 14px; font-size: 12px; '
            f'border: 1px solid {T["border"]}; color: {T["fg"]};">No news yet</div>'
            f'<div style="margin-left: auto; font-size: 12px; color: {T["muted"]}; text-decoration: underline;">Tailor CV</div>'
            f'</div></div>')


OVERDUE_LINE = (f'<div style="display: flex; align-items: center; gap: 6px; margin-top: 5px;">'
                f'<span style="width: 7px; height: 7px; border-radius: 9999px; background: {T["overdue"]}; '
                f'box-shadow: 0 0 10px {T["overdue"]};"></span>'
                f'<span style="font-size: 12px; color: {T["overdue"]};">Overdue by 3 days</span></div>')


def funnel_bar(label, count, width, chroma):
    return (f'<div style="display: flex; flex-direction: column; gap: 5px;">'
            f'<div style="display: flex; justify-content: space-between; font-size: 12px;">'
            f'<span>{label}</span><span style="color: {T["muted"]};">{count}</span></div>'
            f'<div style="height: 8px; border-radius: 9999px; background: oklch(0.24 0.008 268);">'
            f'<div style="width: {width}; height: 8px; border-radius: 9999px; background: {c("tony", chroma)};"></div>'
            f'</div></div>')


tony_body = "\n".join([
    header("tony", "Job tracker", "Add"),
    summary([("ACTIVE", "12"), ("INTERVIEWING", "3"), ("OFFERS", "1")]),
    pulse("tony", "PIPELINE PULSE", "4 of 12 replied &middot; median 9 days", SPARKLE),
    (f'<div style="margin: 0 16px; display: flex; flex-direction: column; gap: 12px; '
     f'border: 1px solid {T["border"]}; border-radius: 16px; padding: 16px; background: {T["elev"]}; '
     f'box-shadow: {T["lip"]};">'
     f'<div style="font-size: 14px; font-weight: 600;">Where they sit</div>'
     f'<div style="display: flex; flex-direction: column; gap: 10px;">'
     + funnel_bar("Applied", 7, "100%", 0.052)
     + funnel_bar("Recruiter screen", 2, "29%", 0.07)
     + funnel_bar("Interviewed", 2, "29%", 0.10)
     + funnel_bar("Final stage", 1, "14%", 0.13)
     + '</div></div>'),
    (f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px;">'
     f'<div style="font-size: 18px; font-weight: 600;">Applications</div>'
     f'<div style="font-size: 12px; color: {T["muted"]}; text-decoration: underline;">Export CSV</div></div>'),
    (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px;">'
     f'<div style="font-size: 11px; letter-spacing: 0.08em; color: {T["muted"]};">FINAL STAGE</div>'
     + app_row("Monzo", "Senior Backend Engineer", "Final stage", OVERDUE_LINE)
     + f'<div style="font-size: 11px; letter-spacing: 0.08em; color: {T["muted"]}; padding-top: 6px;">INTERVIEWED</div>'
     + app_row("Globex", "Data Scientist", "Interviewed")
     + f'<div style="font-size: 11px; letter-spacing: 0.08em; color: {T["muted"]}; padding-top: 6px;">APPLIED</div>'
     + app_row("Initech", "ML Engineer &middot; applied 24 days ago", "Any news on this?", stale=True)
     + app_row("Hooli", "AI Engineer", "Applied")
     + '</div>'),
])

# ---------------------------------------------------------------- Lisa ----
def task_row(title, meta, done=False, overdue=False):
    box = (f'<div style="width: 22px; height: 22px; flex-shrink: 0; border-radius: 9999px; '
           f'background: {c("lisa")}; display: flex; align-items: center; justify-content: center; '
           f'box-shadow: 0 0 12px -2px {mix("lisa", 70)};">'
           f'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{T["bg"]}" stroke-width="4" '
           f'stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 5" /></svg></div>'
           if done else
           f'<div style="width: 22px; height: 22px; flex-shrink: 0; border-radius: 9999px; '
           f'border: 1.5px solid {T["border"]};"></div>')
    flag = ""
    if overdue:
        flag = (f'<div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">'
                f'<span style="width: 7px; height: 7px; border-radius: 9999px; background: {T["overdue"]}; '
                f'box-shadow: 0 0 10px {T["overdue"]};"></span>'
                f'<span style="font-size: 12px; color: {T["overdue"]};">Overdue</span></div>')
    title_style = (f'font-size: 14px; color: {T["muted"]}; text-decoration: line-through;'
                   if done else "font-size: 14px;")
    return (f'<div style="{card()}display: flex; align-items: center; gap: 12px;">{box}'
            f'<div style="min-width: 0; flex-grow: 1;"><div style="{title_style}">{title}</div>'
            f'<div style="font-size: 12px; color: {T["muted"]};">{meta}</div></div>{flag}</div>')


lisa_body = "\n".join([
    header("lisa", "Scheduling", "Add"),
    summary([("DUE TODAY", "3"), ("OVERDUE", "1"), ("DONE", "5")]),
    chips_for("lisa", [("Today", True), ("This Week", False), ("Overdue", False), ("All", False)]),
    (f'<div style="margin: 0 16px; display: flex; align-items: center; gap: 12px; '
     f'border: 1px solid {mix("lisa", 40)}; border-radius: 16px; padding: 14px 16px; '
     f'background: color-mix(in oklch, {c("lisa")} 9%, {T["elev"]}); '
     f'box-shadow: 0 0 34px -12px {mix("lisa", 85)}, inset 0 1px 0 rgba(255, 255, 255, 0.06);">'
     f'<div style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; display: flex; '
     f'align-items: center; justify-content: center; background: {mix("lisa", 22)}; '
     f'box-shadow: 0 0 18px -6px {mix("lisa", 80)};">'
     f'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="{c("lisa")}" stroke-width="1.8" '
     f'stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 3.5L16 11H5" /></svg></div>'
     f'<div style="min-width: 0; flex-grow: 1;">'
     f'<div style="font-size: 10px; font-weight: 500; letter-spacing: 0.14em; color: {T["muted"]};">MILESTONE</div>'
     f'<div style="font-size: 15px; font-weight: 600; color: {c("lisa")};">First interview booked</div></div>'
     f'<div style="flex-shrink: 0; font-size: 12px; color: {T["muted"]};">4 Sep</div></div>'),
    (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px;">'
     f'<div style="font-size: 11px; letter-spacing: 0.08em; color: {T["muted"]};">TODAY &middot; SATURDAY 29</div>'
     + task_row("Chase Monzo about final stage", "One-off &middot; 9:00 AM", overdue=True)
     + task_row("Morning run", "Daily &middot; 7:00 AM")
     + task_row("Update Lloyds balance", "Weekly &middot; done 8:12 AM", done=True)
     + task_row("Call the plumber", "One-off &middot; 5:00 PM")
     + '</div>'),
    (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px;">'
     f'<div style="font-size: 11px; letter-spacing: 0.08em; color: {T["muted"]}; padding-top: 4px;">TOMORROW &middot; SUNDAY 30</div>'
     + task_row("Rent goes out", "Monthly &middot; 12:00 AM")
     + task_row("Morning run", "Daily &middot; 7:00 AM")
     + '</div>'),
])

# --------------------------------------------------------------- Marco ----
SLICE_HUES = [285, 200, 45, 330]


def legend(rows):
    out = []
    for i, (label, amount, share) in enumerate(rows):
        out.append(f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">'
                   f'<span style="width: 8px; height: 8px; flex-shrink: 0; border-radius: 9999px; '
                   f'background: oklch(0.62 0.13 {SLICE_HUES[i]});"></span>'
                   f'<span style="min-width: 0; flex-grow: 1;">{label}</span>'
                   f'<span style="color: {T["muted"]};">{amount}</span>'
                   f'<span style="width: 34px; text-align: right; color: {T["muted"]};">{share}</span></div>')
    return "".join(out)


def session_row(name, quote, mins):
    return (f'<div style="{card()}display: flex; align-items: center; gap: 12px;">'
            f'<div style="min-width: 0; flex-grow: 1;">'
            f'<div style="font-size: 14px; font-weight: 500;">{name}</div>'
            f'<div style="font-size: 12px; color: {T["muted"]};">&ldquo;{quote}&rdquo;</div></div>'
            f'<div style="flex-shrink: 0; font-size: 13px; color: {T["muted"]};">{mins}</div></div>')


bars = "".join(
    f'<div style="flex-grow: 1; height: {h}px; border-radius: 5px; '
    f'background: {c("marco", 0.13 if i == 5 else 0.052)};'
    f'{f" box-shadow: 0 0 16px -4px " + mix("marco", 80) + ";" if i == 5 else ""}"></div>'
    for i, h in enumerate([37, 50, 31, 58, 45, 64]))

labels = "".join(
    f'<div style="flex-grow: 1; text-align: center; font-size: 10px; '
    f'color: {T["fg"] if lb == "25 Aug" else T["muted"]};">{lb}</div>'
    for lb in ["21 Jul", "28 Jul", "4 Aug", "11 Aug", "18 Aug", "25 Aug"])

marco_body = "\n".join([
    header("marco", "Health"),
    (f'<div style="margin: 0 16px; display: flex; flex-direction: column; gap: 2px; '
     f'border: 1px solid {mix("marco", 40)}; border-radius: 16px; padding: 16px; '
     f'background: color-mix(in oklch, {c("marco")} 9%, {T["elev"]}); '
     f'box-shadow: 0 0 34px -12px {mix("marco", 85)}, inset 0 1px 0 rgba(255, 255, 255, 0.06);">'
     f'<div style="font-size: 10px; font-weight: 500; letter-spacing: 0.14em; color: {T["muted"]};">THIS WEEK</div>'
     f'<div style="font-size: 30px; font-weight: 600; color: {c("marco")}; line-height: 1.15;">4 sessions</div>'
     f'<div style="font-size: 12px; color: {T["muted"]};">155 minutes logged</div>'
     f'<div style="font-size: 12px; color: {T["muted"]}; margin-top: 6px;">1 more session than the week before.</div></div>'),
    chips_for("marco", [("This Week", True), ("This Month", False), ("All", False)]),
    (f'<div style="margin: 0 16px; display: flex; flex-direction: column; gap: 14px; '
     f'border: 1px solid {T["border"]}; border-radius: 16px; padding: 16px; background: {T["elev"]}; '
     f'box-shadow: {T["lip"]};">'
     f'<div style="font-size: 14px; font-weight: 600;">Where the minutes went</div>'
     f'<div style="display: flex; align-items: center; gap: 16px;">'
     f'<div style="width: 96px; height: 96px; flex-shrink: 0; border-radius: 9999px; '
     f'background: conic-gradient(oklch(0.62 0.13 285) 0% 38.7%, oklch(0.62 0.13 200) 38.7% 67.7%, '
     f'oklch(0.62 0.13 45) 67.7% 87.1%, oklch(0.62 0.13 330) 87.1% 100%); '
     f'mask: radial-gradient(circle, transparent 52%, black 53%); '
     f'-webkit-mask: radial-gradient(circle, transparent 52%, black 53%);"></div>'
     f'<div style="min-width: 0; flex-grow: 1; display: flex; flex-direction: column; gap: 7px;">'
     + legend([("Cycling", "60 min", "39%"), ("Legs", "45 min", "29%"),
               ("Running", "30 min", "19%"), ("Swimming", "20 min", "13%")])
     + '</div></div></div>'),
    (f'<div style="margin: 0 16px; display: flex; flex-direction: column; gap: 12px; '
     f'border: 1px solid {T["border"]}; border-radius: 16px; padding: 16px; background: {T["elev"]}; '
     f'box-shadow: {T["lip"]};">'
     f'<div style="display: flex; align-items: baseline; justify-content: space-between;">'
     f'<div style="font-size: 14px; font-weight: 600;">Minutes a week</div>'
     f'<div style="font-size: 11px; color: {T["muted"]};">Last 6 weeks</div></div>'
     f'<div style="display: flex; align-items: flex-end; gap: 10px; height: 72px;">{bars}</div>'
     f'<div style="display: flex; gap: 10px;">{labels}</div></div>'),
    (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px;">'
     f'<div style="font-size: 18px; font-weight: 600;">Sessions</div>'
     + session_row("Cycling", "cycled an hour", "60 min")
     + session_row("Legs", "did 45 minutes legs", "45 min")
     + session_row("Running", "ran 30 minutes", "30 min")
     + session_row("Swimming", "swam 20 minutes", "20 min")
     + '</div>'),
])

# ------------------------------------------------------------- Vanessa ----
def account_card(name, balance, goal, meta, stale=False):
    bar = c("marco", 0) if stale else c("vanessa")
    return (f'<div style="width: 176px; flex-shrink: 0; border: 1px solid '
            f'{T["stale_border"] if stale else T["border"]}; border-radius: 16px; padding: 12px; '
            f'background: {T["stale_bg"] if stale else T["elev"]}; '
            f'box-shadow: {"none" if stale else T["lip"]};">'
            f'<span style="display: block; width: 64px; height: 4px; border-radius: 9999px; margin-bottom: 12px; '
            f'background: {"oklch(0.45 0 70)" if stale else c("vanessa")};'
            f'{"" if stale else f" box-shadow: 0 0 12px -2px {mix('vanessa', 80)};"}"></span>'
            f'<div style="font-size: 14px; font-weight: 500; color: {T["stale_fg"] if stale else T["fg"]};">{name}</div>'
            f'<div style="font-size: 20px; font-weight: 600; color: {T["stale_fg"] if stale else T["fg"]};">{balance}</div>'
            f'<div style="font-size: 11px; color: {T["muted"]};">{goal}</div>'
            f'<div style="font-size: 11px; color: {T["overdue"] if stale else T["muted"]}; margin-top: 4px;">{meta}</div></div>')


def txn_row(category, meta, account, amount, income=False):
    colour = "oklch(0.72 0.16 155)" if income else T["fg"]
    return (f'<div style="{card()}display: flex; align-items: center; gap: 12px;">'
            f'<div style="min-width: 0; flex-grow: 1;">'
            f'<div style="font-size: 14px;">{category}</div>'
            f'<div style="font-size: 12px; color: {T["muted"]};">{meta}</div>'
            f'<div style="font-size: 11px; color: {c("vanessa")};">{account}</div></div>'
            f'<div style="flex-shrink: 0; font-size: 14px; font-weight: 600; color: {colour};">{amount}</div></div>')


vanessa_body = "\n".join([
    header("vanessa", "Money manager", "Account"),
    (f'<div style="margin: 0 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); '
     f'border: 1px solid {T["border"]}; border-radius: 16px; background: {T["elev"]}; padding: 12px 0; '
     f'box-shadow: {T["lip"]};">'
     f'<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 8px;">'
     f'<div style="font-size: 10px; letter-spacing: 0.08em; color: {T["muted"]};">INCOME</div>'
     f'<div style="font-size: 18px; font-weight: 600; color: oklch(0.72 0.16 155);">£991.00</div></div>'
     f'<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 8px; '
     f'border-left: 1px solid {T["border"]}; border-right: 1px solid {T["border"]};">'
     f'<div style="font-size: 10px; letter-spacing: 0.08em; color: {T["muted"]};">EXPENSES</div>'
     f'<div style="font-size: 18px; font-weight: 600; color: {T["overdue"]};">£24.00</div></div>'
     f'<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 8px;">'
     f'<div style="font-size: 10px; letter-spacing: 0.08em; color: {T["muted"]};">NET</div>'
     f'<div style="font-size: 18px; font-weight: 600; color: oklch(0.72 0.16 155);">+£967.00</div></div></div>'),
    pulse("vanessa", "FINANCIAL PULSE", "4.2 months of runway", SPARKLE),
    (f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px;">'
     f'<div style="display: flex; align-items: baseline; gap: 8px;">'
     f'<div style="font-size: 18px; font-weight: 600;">Accounts</div>'
     f'<div style="border-radius: 9999px; padding: 3px 10px; font-size: 12px; background: {mix("vanessa", 18)}; '
     f'color: {c("vanessa")};">£1,042.48</div></div>'
     f'<div style="display: flex; align-items: center; gap: 6px; border: 1px solid {T["border"]}; '
     f'border-radius: 9999px; padding: 4px 10px;">'
     f'<span style="width: 7px; height: 7px; border-radius: 9999px; background: {T["overdue"]};"></span>'
     f'<span style="font-size: 11px; color: {T["muted"]};">1 stale</span></div></div>'),
    (f'<div style="display: flex; gap: 10px; padding: 0 16px; overflow: hidden;">'
     + account_card("Lloyds", "£992.48", "Salary account", "Updated today")
     + account_card("HSBC", "£50.00", "Emergency fund", "Stale &middot; 12d")
     + '</div>'),
    chips_for("vanessa", [("Today", False), ("This Week", False), ("This Month", True), ("Custom", False)]),
    (f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px;">'
     f'<div style="font-size: 18px; font-weight: 600;">Transactions</div>'
     f'<div style="font-size: 12px; color: {T["muted"]}; text-decoration: underline;">Export CSV</div></div>'),
    (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px;">'
     + txn_row("Income", "29/08 &middot; income 991 pounds", "Lloyds", "+£991.00", income=True)
     + txn_row("Groceries", "29/08 &middot; spent 24 at asda", "Lloyds", "−£24.00")
     + '</div>'),
])

# -------------------------------------------------------------- Jarvis ----
# A good day is an empty screen with a slowly turning orb. That emptiness is
# the product's signature, so nothing gets added to fill it.
jarvis_body = "\n".join([
    (f'<div style="padding: 0 16px; display: flex; align-items: flex-start; justify-content: space-between;">'
     f'<div><div style="font-size: 14px; color: {T["muted"]};">Saturday, August 29</div>'
     f'<div style="font-size: 22px; font-weight: 600;">Good morning</div></div>'
     f'<div style="font-size: 12px; color: {T["muted"]}; text-decoration: underline;">Settings</div></div>'),
    (f'<div style="display: flex; align-items: center; justify-content: center; padding: 28px 0 20px 0;">'
     + orb_svg() + '</div>'),
    (f'<div style="padding: 0 16px;">'
     f'<div style="{card()}display: flex; align-items: flex-start; gap: 10px;">'
     f'<span style="width: 7px; height: 7px; border-radius: 9999px; background: {T["overdue"]}; '
     f'margin-top: 5px; flex-shrink: 0; box-shadow: 0 0 10px {T["overdue"]};"></span>'
     f'<div><div style="font-size: 14px;">Monzo &mdash; Final stage</div>'
     f'<div style="font-size: 12px; color: {T["overdue"]};">Overdue by 3 days</div></div></div></div>'),
])

SCREENS = {
    "Main": ("tony", 1240, tony_body, "e.g. applied to Acme for Data Scientist"),
    "Lisa": ("lisa", 960, lisa_body, "e.g. remind me to call the plumber at 5pm"),
    "Marco": ("marco", 1120, marco_body, "e.g. did 45 minutes legs"),
    "Vanessa": ("vanessa", 1060, vanessa_body, "e.g. £12 on lunch at Monzo"),
    "Jarvis": ("jarvis", 820, jarvis_body, "e.g. what's my runway?"),
}

for filename, (agent, height, body, placeholder) in SCREENS.items():
    with open(filename + ".dc.html", "w", encoding="utf-8") as handle:
        handle.write(page(agent, height, body, placeholder))
    print("wrote", filename)
