import html, os, sys
OUT = sys.argv[1]
W = 1200
MCX, SCX = 400, 900            # main / side column centre x
SIZES = {'card': (420, 88), 'diamond': (340, 152), 'pill': (360, 64), 'side': (320, 88), 'note': (320, 128)}
STY = {
  'card':   'background: #FFFFFF; border: 1.5px solid #DCE1EB; border-radius: 14px; color: #0E1726',
  'server': 'background: #E2F3F4; border: 1.5px solid #0A6F78; border-radius: 14px; color: #0E1726',
  'email':  'background: #E3E9FF; border: 1.5px solid #2F4FC9; border-radius: 14px; color: #0E1726',
  'pill':   'background: #0E1726; border-radius: 999px; color: #FFFFFF; font-weight: 700',
  'diamond':'background: #FFF1CC; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); color: #0E1726; font-weight: 700; font-size: 14px; line-height: 18px; padding: 0 74px',
  'error':  'background: #FDE3E1; border: 1.5px solid #B42318; border-radius: 14px; color: #B42318; font-weight: 600',
  'ok':     'background: #DDF5EC; border: 1.5px solid #0F7B5F; border-radius: 14px; color: #0F7B5F; font-weight: 700',
  'leave':  'background: #E3E9FF; border: 1.5px solid #2F4FC9; border-radius: 14px; color: #2F4FC9; font-weight: 700',
  'holiday':'background: #F1E6FB; border: 1.5px solid #7A2BB8; border-radius: 14px; color: #7A2BB8; font-weight: 700',
  'off':    'background: #EDF0F4; border: 1.5px solid #4A5568; border-radius: 14px; color: #4A5568; font-weight: 700',
  'half':   'background: #FFF1CC; border: 1.5px solid #8A5A00; border-radius: 14px; color: #8A5A00; font-weight: 700',
  'late':   'background: #FFE8D6; border: 1.5px solid #B54708; border-radius: 14px; color: #B54708; font-weight: 700',
  'absent': 'background: #FDE3E1; border: 2px solid #B42318; border-radius: 999px; color: #B42318; font-weight: 700',
  'note':   'background: #FFFFFF; border: 1.5px dashed #5B6475; border-radius: 14px; color: #4A5568; font-size: 14px; line-height: 19px; text-align: left; justify-content: flex-start',
}
STROKE = '#5B6475'
ROW0, PITCH = 240, 184

def cy(r): return ROW0 + r * PITCH

class D:
    def __init__(s): s.arrows, s.cards, s.labels, s.mid = [], [], [], 0
    def seg(s, x1, y1, x2, y2, head):
        # (x1,y1) tail -> (x2,y2) tip
        hh = 4 if head else 0
        s.mid += 1 if head else 0
        mk = ''
        if head:
            mid = f'dc-arrow-head-filled-{s.mid}'
            mk = f'<defs><marker id="{mid}" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible"><path d="M0 0 L4 2 L0 4 Z" fill="{STROKE}" stroke="none" style="stroke: none; fill: {STROKE}; fill: context-stroke"/></marker></defs>'
            me = f' marker-end="url(#{mid})"'
        else:
            me = ''
        if y1 == y2:
            n = abs(x2 - x1); left = min(x1, x2); w, h = n, 8; top = y1 - 4
            p = f'M 0 4 L {n-hh} 4' if x2 > x1 else f'M {n} 4 L {hh} 4'
        else:
            n = abs(y2 - y1); top = min(y1, y2); w, h = 8, n; left = x1 - 4
            p = f'M 4 0 L 4 {n-hh}' if y2 > y1 else f'M 4 {n} L 4 {hh}'
        s.arrows.append(f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" preserveAspectRatio="none" style="position: absolute; left: {left}px; top: {top}px; width: {w}px; height: {h}px; overflow: visible; fill: none; stroke: {STROKE}; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round">{mk}<path d="{p}"{me}></path></svg>')
    def card(s, kind, cx_, cy_, label, size):
        w, h = SIZES[size]
        st = STY[kind]
        base = f'position: absolute; left: {cx_-w//2}px; top: {cy_-h//2}px; width: {w}px; height: {h}px; box-sizing: border-box; padding: 8px 16px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 15px; line-height: 20px; '
        if kind == 'diamond':
            base = base.replace('padding: 8px 16px; ', '')
        s.cards.append(f'<div style="{base}{st}"><span>{label}</span></div>')
        return (cx_ - w//2, cy_ - h//2, w, h)
    def label(s, x, y, text, w=None):
        w = w or (len(text) * 8 + 8)
        s.labels.append(f'<div style="position: absolute; left: {x}px; top: {y}px; width: {w}px; text-align: center; font-size: 13px; line-height: 16px; font-weight: 700; color: #4A5568">{text}</div>')

def build(fname, title, sub, nodes, notes=()):
    """nodes: list of dicts {kind,label, size?, down?, branch?:{kind,label,lab,mode:'loop'|'rejoin'|'end', to?:row, back?:'fix'}}"""
    d = D()
    boxes = []
    for r, n in enumerate(nodes):
        size = n.get('size') or ('diamond' if n['kind'] == 'diamond' else 'pill' if n['kind'] in ('pill', 'absent') else 'card')
        boxes.append(d.card(n['kind'], MCX, cy(r), n['label'], size))
    # vertical arrows between main nodes
    for r in range(len(nodes) - 1):
        l, t, w, h = boxes[r]; l2, t2, w2, h2 = boxes[r + 1]
        d.seg(MCX, t + h, MCX, t2 - 1, True)
        if nodes[r].get('down'):
            midy = (t + h + t2) // 2
            d.label(MCX + 12, midy - 8, nodes[r]['down'])
    # branches
    for r, n in enumerate(nodes):
        b = n.get('branch')
        if not b: continue
        l, t, w, h = boxes[r]
        sw, sh = SIZES['side']
        sl = SCX - sw // 2
        d.card(b['kind'], SCX, cy(r), b['label'], 'side')
        d.seg(l + w, cy(r), sl - 1, cy(r), True)
        lw = len(b['lab']) * 8 + 8
        d.label((l + w + sl) // 2 - lw // 2, cy(r) - 28, b['lab'], lw)
        mode = b.get('mode', 'end')
        if mode in ('loop', 'rejoin'):
            tr = b['to']
            tl, tt, tw, th = boxes[tr]
            ty = cy(tr)
            if mode == 'loop':
                y1 = cy(r) - sh // 2
                d.seg(SCX, y1, SCX, ty, False)
                mid = (ty + y1) // 2
            else:
                y1 = cy(r) + sh // 2
                d.seg(SCX, y1, SCX, ty, False)
                mid = (ty + y1) // 2
            d.seg(SCX, ty, tl + tw + 1, ty, True)
            if b.get('back'):
                lw = len(b['back']) * 8 + 8
                d.label(SCX + 12, mid - 8, b['back'], lw)
    for (r, text) in notes:
        d.card('note', SCX, cy(r), text, 'note')
    H = cy(len(nodes) - 1) + 120 + 64
    body = '\n'.join(d.arrows + d.cards + d.labels)
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Space+Grotesk:wght@500;600;700&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:#0A6F78}}a:hover{{color:#074F55}}
</style>
</helmet>
<div style="position: relative; width: {W}px; height: {H}px; background: #FFFFFF; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #0E1726">
<div style="position: absolute; left: 64px; top: 56px; font-family: 'Space Grotesk', sans-serif; font-size: 36px; font-weight: 700; letter-spacing: -0.02em">{title}</div>
<div style="position: absolute; left: 64px; top: 108px; width: 1072px; font-size: 15px; line-height: 20px; color: #5B6475">{sub}</div>
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
    open(os.path.join(OUT, fname), 'w').write(doc)
    print(fname, W, H)

SUB = 'White = user step · teal = server / database · blue = email · amber diamond = decision · red = error or blocked'

build('Flow1-AddEmployee.dc.html', '1 · Add employee (HR Admin)', SUB, [
  dict(kind='pill', label='HR clicks <b>Add employee</b>'),
  dict(kind='card', label='<b>Step 1 · Personal</b><br>name, DOB, gender, mobile, address, PIN, state'),
  dict(kind='diamond', label='Personal fields valid?', down='yes',
       branch=dict(kind='error', label='Inline error, e.g. “Mobile must be 10 digits starting 6–9” or “Must be 18+ on joining date”', lab='no', mode='loop', to=1, back='fix')),
  dict(kind='card', label='<b>Step 2 · Job</b><br>designation, department, location, reporting manager, joining date'),
  dict(kind='diamond', label='Manager valid?', down='yes',
       branch=dict(kind='error', label='Blocked: cannot report to self or to someone who reports to them', lab='no', mode='loop', to=3, back='fix')),
  dict(kind='card', label='<b>Step 3 · Statutory &amp; bank</b><br>PAN, Aadhaar, UAN (optional), IFSC, account no.'),
  dict(kind='diamond', label='Formats valid?', down='yes',
       branch=dict(kind='error', label='Error, e.g. “ABC123 is not a valid PAN (ABCDE1234F)”', lab='no', mode='loop', to=5, back='fix')),
  dict(kind='server', label='<b>Server</b> · requireHR() → one DB transaction inserts employee + statutory + bank'),
  dict(kind='server', label='<b>Database</b> · generates code KCF0021 (sequence + UNIQUE) · writes audit_log'),
  dict(kind='server', label='<b>Server</b> · creates 2026 leave balances · CL/SL pro-rated from joining date'),
  dict(kind='pill', label='Employee signs in with Clerk · linked by email'),
])

build('Flow2-CheckIn.dc.html', '2 · Check-in → day status', SUB + ' · coloured cards = final status', [
  dict(kind='pill', label='Employee taps <b>Check in</b>'),
  dict(kind='diamond', label='Active employee?', down='yes',
       branch=dict(kind='error', label='Access denied page (past last working day)', lab='no')),
  dict(kind='server', label='<b>Server</b> · date = todayIST() · INSERT attendance … ON CONFLICT (employee, date) DO NOTHING'),
  dict(kind='diamond', label='Check-in after 10:15 IST?', down='no',
       branch=dict(kind='late', label='Mark <b>Late</b> (is_late = true)', lab='yes', mode='rejoin', to=4)),
  dict(kind='card', label='Employee taps <b>Check out</b> · check_out saved on the same row'),
  dict(kind='server', label='<b>Day status</b> · computed on read for the IST date, checked in this order ↓'),
  dict(kind='diamond', label='Approved full-day leave?', down='no',
       branch=dict(kind='leave', label='On Leave (even if punched)', lab='yes')),
  dict(kind='diamond', label='Holiday at their location?', down='no',
       branch=dict(kind='holiday', label='Holiday', lab='yes')),
  dict(kind='diamond', label='Weekly off at their location?', down='no',
       branch=dict(kind='off', label='Weekly Off · HO Sat+Sun · Plant Sun', lab='yes')),
  dict(kind='diamond', label='Approved half-day leave?', down='no',
       branch=dict(kind='leave', label='0.5 leave + other half: 4h+ worked = 0.5 present, else 0.5 LOP', lab='yes')),
  dict(kind='diamond', label='Marked WFH?', down='no',
       branch=dict(kind='ok', label='Present (WFH)', lab='yes')),
  dict(kind='diamond', label='Worked 8h or more?', down='no',
       branch=dict(kind='ok', label='Present', lab='yes')),
  dict(kind='diamond', label='Worked 4h or more?', down='no',
       branch=dict(kind='half', label='Half Day', lab='yes')),
  dict(kind='absent', label='Absent · missed punch → regularise'),
], notes=[(0, '<span><b>Late rule</b> · every 3rd Late in a calendar month adds 0.5 day LOP in the month-end summary. A second Check in tap never creates a new row.</span>')])

build('Flow3-ApplyLeave.dc.html', '3 · Apply leave → approval → balance', SUB, [
  dict(kind='pill', label='Employee opens <b>Apply leave</b>'),
  dict(kind='card', label='Picks type, from / to, full or half day, reason'),
  dict(kind='server', label='<b>Server</b> · counts working days: skips location weekly offs + holidays (no sandwich rule)'),
  dict(kind='diamond', label='Dates allowed?', down='yes',
       branch=dict(kind='error', label='Error: over 30 days back, crosses 31 Dec, or after last working day', lab='no', mode='loop', to=1, back='fix')),
  dict(kind='diamond', label='SL of 3+ working days?', down='no',
       branch=dict(kind='card', label='Medical certificate upload required before submit', lab='yes', mode='rejoin', to=5)),
  dict(kind='server', label='<b>Server</b> · available = opening + accrued − used − pending'),
  dict(kind='diamond', label='Days ≤ available?', down='yes',
       branch=dict(kind='card', label='Offer: convert the excess days to LOP', lab='no', mode='rejoin', to=7)),
  dict(kind='server', label='Save request · status <b>Pending</b> · balance unchanged, shown as pending'),
  dict(kind='email', label='<b>Email manager</b> (Gmail SMTP) · request appears in Approvals inbox'),
  dict(kind='diamond', label='Manager approves? (approver ≠ applicant)', down='yes',
       branch=dict(kind='error', label='Rejected with comment · employee emailed · balance unchanged', lab='no')),
  dict(kind='server', label='<b>approve_leave()</b> · one transaction: re-check balance, status Approved → used ↑, available ↓'),
  dict(kind='email', label='<b>Email employee</b> · days show On Leave in both calendars'),
  dict(kind='diamond', label='Cancelled before start date?', down='no',
       branch=dict(kind='ok', label='Status Cancelled · balance restored', lab='yes')),
  dict(kind='pill', label='Leave taken · counted in month-end CSV'),
])

build('Flow4-Regularise.dc.html', '4 · Missed punch → regularisation', SUB, [
  dict(kind='pill', label='Missed punch · day shows Absent / Half Day'),
  dict(kind='card', label='Employee opens <b>My attendance</b>, picks the day, enters correct in / out + reason'),
  dict(kind='diamond', label='Reason given and date within 7 days?', down='yes',
       branch=dict(kind='error', label='Error: reason required, or older than 7 days (ask HR)', lab='no', mode='loop', to=1, back='fix')),
  dict(kind='server', label='Save regularisation request · <b>Pending</b> · attendance unchanged'),
  dict(kind='email', label='<b>Manager notified</b> · Approvals inbox + email'),
  dict(kind='diamond', label='Manager approves? (direct report only)', down='yes',
       branch=dict(kind='error', label='Rejected with comment · attendance stays as it was', lab='no')),
  dict(kind='server', label='<b>One transaction</b> · update check_in / check_out · audit_log (who, old, new, when)'),
  dict(kind='server', label='Day status recalculated (e.g. Absent → Present) · month summary updates'),
  dict(kind='pill', label='Done'),
], notes=[(0, '<span><b>HR shortcut</b> · HR Admin can correct a record directly, but must enter a reason, which is logged.</span>')])
