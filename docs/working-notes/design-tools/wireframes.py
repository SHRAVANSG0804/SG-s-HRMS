"""Generates the low-fi wireframe artboards (Wf-*.dc.html) for the Tarang HR design canvas."""
import os, sys

OUT = sys.argv[1]
W, H = 1280, 880
INK, MUTED, LINE, GROUND, ACCENT, TEAL = '#0E1726', '#5B6475', '#DCE1EB', '#F4F6FB', '#D63A16', '#0A6F78'
STATUS = {
    'present': ('#DDF5EC', '#0F7B5F', 'Present'), 'wfh': ('#DDF5EC', '#0F7B5F', 'WFH'),
    'half': ('#FFF1CC', '#8A5A00', 'Half day'), 'absent': ('#FDE3E1', '#B42318', 'Absent'),
    'leave': ('#E3E9FF', '#2F4FC9', 'On leave'), 'holiday': ('#F1E6FB', '#7A2BB8', 'Holiday'),
    'off': ('#EDF0F4', '#4A5568', 'Weekly off'), 'late': ('#FFE8D6', '#B54708', 'Late'),
    'pending': ('#FFF1CC', '#8A5A00', 'Pending'), 'approved': ('#DDF5EC', '#0F7B5F', 'Approved'),
    'rejected': ('#FDE3E1', '#B42318', 'Rejected'), 'cancelled': ('#EDF0F4', '#4A5568', 'Cancelled'),
    'active': ('#DDF5EC', '#0F7B5F', 'Active'), 'inactive': ('#EDF0F4', '#4A5568', 'Inactive'),
    'none': ('#FFFFFF', '#5B6475', ''),
}
LETTER = {'present': 'P', 'wfh': 'W', 'half': '½', 'absent': 'A', 'leave': 'L', 'holiday': 'H', 'off': '–', 'late': 'P', 'none': ''}

NAV_HR = ['Home', 'My attendance', 'Leave', 'Approvals', 'Team attendance', 'Leave calendar', 'Reports', 'Employees', 'Settings', 'Ask HR']
NAV_MGR = ['Home', 'My attendance', 'Leave', 'Approvals', 'Team attendance', 'Leave calendar', 'Reports', 'Ask HR']
NAV_EMP = ['Home', 'My attendance', 'Leave', 'Ask HR', 'My profile']


def badge(kind, text=None):
    bg, fg, t = STATUS[kind]
    return f'<span style="display: inline-block; background: {bg}; color: {fg}; font-size: 12px; font-weight: 800; border-radius: 999px; padding: 3px 10px; white-space: nowrap">{text or t}</span>'


def btn(text, kind='primary', grow=False):
    s = {'primary': f'border: 0; background: {ACCENT}; color: #FFFFFF',
         'dark': f'border: 0; background: {INK}; color: #FFFFFF',
         'outline': f'border: 1.5px solid {LINE}; background: #FFFFFF; color: {INK}',
         'approve': 'border: 0; background: #0F7B5F; color: #FFFFFF',
         'reject': 'border: 1.5px solid #B42318; background: #FFFFFF; color: #B42318',
         'teal': f'border: 0; background: {TEAL}; color: #FFFFFF'}[kind]
    g = 'flex: 1; ' if grow else ''
    return f'<button type="button" style="{g}min-height: 44px; border-radius: 12px; padding: 0 18px; font-weight: 700; font-size: 14px; {s}">{text}</button>'


def field(fid, label, value='', hint='', error='', kind='input', flex='1 1 220px', lock=False):
    border = '2px solid #B42318' if error else f'1.5px solid {LINE}'
    bg = '#FFF8F7' if error else ('#F4F6FB' if lock else '#FFFFFF')
    aria = f' aria-invalid="true" aria-describedby="{fid}-e"' if error else ''
    ro = ' readonly' if lock else ''
    if kind == 'select':
        ctrl = f'<select id="{fid}" style="min-height: 44px; border: {border}; border-radius: 12px; padding: 0 12px; font: inherit; font-size: 14px; background: {bg}"><option>{value}</option></select>'
    elif kind == 'textarea':
        ctrl = f'<textarea id="{fid}" rows="3" style="border: {border}; border-radius: 12px; padding: 10px 12px; font: inherit; font-size: 14px; resize: none">{value}</textarea>'
    else:
        ctrl = f'<input id="{fid}" type="text" value="{value}"{ro}{aria} style="min-height: 44px; box-sizing: border-box; border: {border}; border-radius: 12px; padding: 0 12px; font: inherit; font-size: 14px; background: {bg}; width: 100%">'
    lk = f' <span style="font-weight: 600; color: {MUTED}">· read-only</span>' if lock else ''
    extra = ''
    if error:
        extra = f'<span id="{fid}-e" style="font-size: 12px; font-weight: 600; color: #B42318">{error}</span>'
    elif hint:
        extra = f'<span style="font-size: 12px; color: {MUTED}">{hint}</span>'
    return f'<div style="flex: {flex}; min-width: 0; display: flex; flex-direction: column; gap: 6px"><label for="{fid}" style="font-size: 13px; font-weight: 700">{label}{lk}</label>{ctrl}{extra}</div>'


def card(inner, extra=''):
    return f'<div style="background: #FFFFFF; border: 1px solid #E3E7EF; border-radius: 20px; padding: 22px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; min-width: 0; {extra}">{inner}</div>'


def h2(t, right=''):
    return f'<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px"><h2 style="margin: 0; font-family: \'Space Grotesk\', sans-serif; font-size: 19px; letter-spacing: -0.01em">{t}</h2>{right}</div>'


def table(headers, rows, widths=None):
    cols = widths or ' '.join(['minmax(0, 1fr)'] * len(headers))
    hdr = ''.join(f'<span>{h}</span>' for h in headers)
    out = [f'<div style="display: grid; grid-template-columns: {cols}; gap: 12px; padding: 10px 14px; background: {GROUND}; border-radius: 10px; font-size: 12px; font-weight: 800; color: {MUTED}">{hdr}</div>']
    for r in rows:
        cells = ''.join(f'<span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{c}</span>' for c in r)
        out.append(f'<div style="display: grid; grid-template-columns: {cols}; gap: 12px; padding: 11px 14px; border-bottom: 1px solid #EEF1F6; font-size: 14px; align-items: center">{cells}</div>')
    return '<div style="display: flex; flex-direction: column">' + ''.join(out) + '</div>'


def tabs(items, active):
    out = []
    for t in items:
        on = t == active
        st = f'border-bottom: 3px solid {ACCENT}; color: {INK}; font-weight: 800' if on else f'border-bottom: 3px solid transparent; color: {MUTED}; font-weight: 600'
        out.append(f'<a href="#" style="padding: 10px 2px; text-decoration: none; font-size: 14px; {st}">{t}</a>')
    return f'<nav aria-label="Tabs" style="display: flex; gap: 24px; border-bottom: 1px solid {LINE}">' + ''.join(out) + '</nav>'


def shell(fname, title, nav, active, user, heading, sub, actions, body):
    links = []
    for n in nav:
        on = n == active
        st = f'background: #FFFFFF; color: {INK}; font-weight: 700' if on else 'background: transparent; color: #D5DBE7; font-weight: 500'
        links.append(f'<a href="#" style="display: block; padding: 9px 12px; border-radius: 10px; text-decoration: none; font-size: 14px; {st}">{n}</a>')
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Space+Grotesk:wght@500;600;700&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:{TEAL}}}a:hover{{color:#074F55}}
button{{font-family:inherit}}
</style>
</helmet>
<div style="width: {W}px; height: {H}px; display: flex; overflow: hidden; background: {GROUND}; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: {INK}">
<nav aria-label="Main" style="width: 212px; flex: none; box-sizing: border-box; background: {INK}; color: #FFFFFF; padding: 22px 14px; display: flex; flex-direction: column; gap: 22px">
<div style="display: flex; align-items: center; gap: 10px; padding: 0 6px">
<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="{ACCENT}"></rect><path d="M7 18c3.5 0 3.5-5 7-5s3.5 5 7 5 3.5-5 7-5 3.5 5 5 5" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"></path><path d="M7 27c3.5 0 3.5-5 7-5s3.5 5 7 5 3.5-5 7-5 3.5 5 5 5" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"></path></svg>
<span style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 19px">Tarang HR</span>
</div>
<div style="display: flex; flex-direction: column; gap: 2px">{''.join(links)}</div>
<div style="margin-top: auto; padding: 10px; border-radius: 12px; background: #1A2538; font-size: 13px"><b>{user[0]}</b><br><span style="color: #AEB8CC">{user[1]}</span></div>
</nav>
<main style="flex: 1; min-width: 0; box-sizing: border-box; padding: 28px 32px; display: flex; flex-direction: column; gap: 20px">
<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; font-weight: 600; color: {MUTED}">{sub}</span><h1 style="margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 30px; letter-spacing: -0.03em">{heading}</h1></div>
<div style="display: flex; gap: 10px; align-items: center">{actions}</div>
</header>
{body}
</main>
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
    print(fname)


HR = ('Asha Kerkar', 'KCF0001 · HR Admin')
MGR = ('Priya Naik', 'KCF0012 · Manager')
EMP = ('Sneha Prabhu', 'KCF0015 · Employee')
row = lambda inner, gap=20: f'<div style="display: flex; gap: {gap}px; min-height: 0">{inner}</div>'

# 1 · My profile (employee viewing self, Statutory tab)
prof_head = card(f'''<div style="display: flex; gap: 18px; align-items: center">
<div aria-hidden="true" style="width: 72px; height: 72px; border-radius: 999px; background: #FF8A66; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px">SP</div>
<div style="display: flex; flex-direction: column; gap: 4px; flex: 1"><span style="font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700">Sneha Prabhu</span>
<span style="font-size: 14px; color: {MUTED}">KCF0015 · Accounts Executive · Finance · Panaji Head Office · reports to Priya Naik</span></div>{badge('active')}</div>''')
stat_rows = [('PAN', 'ABCDE****F'), ('Aadhaar', 'XXXX XXXX 4417'), ('UAN', '1009 **** 2231'), ]
stat = ''.join(f'<div style="display: grid; grid-template-columns: 140px minmax(0, 1fr); padding: 12px 0; border-bottom: 1px solid #EEF1F6; font-size: 14px"><span style="color: {MUTED}">{k}</span><span style="font-family: ui-monospace, Menlo, monospace; font-weight: 700">{v}</span></div>' for k, v in stat_rows)
prof_tabs = card(tabs(['Personal', 'Job', 'Statutory', 'Bank', 'Emergency contact'], 'Statutory') + stat +
                 f'<span style="font-size: 13px; color: {MUTED}">Masked for everyone. Only HR can edit statutory details or click Reveal (logged).</span>', 'flex: 3 1 0')
contact = card(h2('Contact details') + field('p-mob', 'Mobile', '98220 41763', 'Starts with 6, 7, 8 or 9 · 10 digits', flex='none') +
               field('p-addr', 'Address', 'H.No. 112, Altinho, Panaji', flex='none') +
               '<div style="display: flex; gap: 10px">' + field('p-pin', 'PIN', '403001', flex='1') + field('p-state', 'State', 'Goa', kind='select', flex='1') + '</div>' +
               btn('Save changes', 'primary'), 'flex: 2 1 0')
shell('Wf-Profile.dc.html', 'Wireframe · My profile', NAV_EMP, 'My profile', EMP, 'My profile', 'Everyone · own record only', '',
      prof_head + row(prof_tabs + contact))

# 2 · Employee directory (HR)
emps = [('KCF0001', 'Asha Kerkar', 'HR Manager', 'HR', 'Panaji', '—', 'active'),
        ('KCF0012', 'Priya Naik', 'Finance Manager', 'Finance', 'Panaji', 'Rahul Kamat', 'active'),
        ('KCF0013', 'Vikram Shetye', 'Senior Accountant', 'Finance', 'Panaji', 'Priya Naik', 'active'),
        ('KCF0015', 'Sneha Prabhu', 'Accounts Executive', 'Finance', 'Panaji', 'Priya Naik', 'active'),
        ('KCF0004', 'Santosh Gawas', 'Line Supervisor', 'Production', 'Verna', 'Mahesh Naik', 'active'),
        ('KCF0007', 'Ravi Kunkolienkar', 'Machine Operator', 'Production', 'Verna', 'Santosh Gawas', 'active'),
        ('KCF0009', 'Lata Gaude', 'QA Technician', 'Quality', 'Verna', 'Mahesh Naik', 'active'),
        ('KCF0006', 'Agnelo D\'Souza', 'Store Keeper', 'Production', 'Verna', 'Santosh Gawas', 'inactive')]
search = f'''<div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap">
<div style="flex: 2 1 280px; display: flex; flex-direction: column; gap: 6px"><label for="d-q" style="font-size: 13px; font-weight: 700">Search</label><input id="d-q" type="text" placeholder="Name or employee code" style="min-height: 44px; box-sizing: border-box; border: 1.5px solid {LINE}; border-radius: 12px; padding: 0 12px; font: inherit; font-size: 14px"></div>
{field('d-dept', 'Department', 'All departments', kind='select', flex='1 1 160px')}{field('d-loc', 'Location', 'All locations', kind='select', flex='1 1 160px')}{field('d-st', 'Status', 'Active', kind='select', flex='1 1 140px')}</div>'''
dir_tbl = table(['Code', 'Name', 'Designation', 'Department', 'Location', 'Manager', 'Status'],
                [(f'<b>{c}</b>', n, d, dp, l, m, badge(s)) for c, n, d, dp, l, m, s in emps],
                '90px minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) 80px minmax(0,1.1fr) 90px')
shell('Wf-Directory.dc.html', 'Wireframe · Employee directory', NAV_HR, 'Employees', HR, 'Employees', 'HR Admin only · 20 employees',
      btn('Add employee', 'primary'), card(search + dir_tbl + f'<span style="font-size: 13px; color: {MUTED}">Showing 1–8 of 20 · inactive employees stay in the list, never deleted</span>', 'flex: 1'))

# 3 · Add employee, step 3
steps = [('1', 'Personal', 'done'), ('2', 'Job', 'done'), ('3', 'Statutory &amp; bank', 'on'), ('4', 'Review', '')]
stepper = '<div style="display: flex; gap: 12px">' + ''.join(
    f'<div style="flex: 1; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: {"#FFFFFF" if s != "on" else INK}; color: {"#FFFFFF" if s == "on" else INK}; border: 1px solid #E3E7EF"><span style="width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; background: {"#0F7B5F" if s == "done" else (ACCENT if s == "on" else "#EDF0F4")}; color: {"#FFFFFF" if s else MUTED}">{"✓" if s == "done" else n}</span><span style="font-weight: 700; font-size: 14px">{t}</span></div>'
    for n, t, s in steps) + '</div>'
form = card(h2('Statutory details') +
            '<div style="display: flex; gap: 16px">' + field('a-pan', 'PAN', 'ABC123', error='PAN must be 5 letters, 4 digits, 1 letter, e.g. ABCDE1234F') +
            field('a-aad', 'Aadhaar', '•••• •••• ••••', hint='12 digits · stored, never shown in full') + field('a-uan', 'UAN (optional)', '', hint='12 digits · blank for first job') + '</div>' +
            h2('Bank details') +
            '<div style="display: flex; gap: 16px">' + field('a-bank', 'Bank name', 'State Bank of India') + field('a-acc', 'Account number', '38291047711') +
            field('a-ifsc', 'IFSC', 'SBIN0001234', hint='4 letters, 0, then 6 letters or digits') + '</div>' +
            f'<div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #EEF1F6; padding-top: 16px"><span style="font-size: 13px; color: {MUTED}">Employee code is generated on save (next: KCF0021) · every field is checked again on the server</span><div style="display: flex; gap: 10px">{btn("Back", "outline")}{btn("Next: Review", "primary")}</div></div>')
shell('Wf-AddEmployee.dc.html', 'Wireframe · Add employee', NAV_HR, 'Employees', HR, 'Add employee', 'HR Admin only · step 3 of 4', '', stepper + form)

# 4 · My attendance (October 2026, HO, Mon-first)
oct_status = {}
for d in range(1, 32):
    dow = (d + 2) % 7  # 1 Oct 2026 = Thursday -> Mon=0 index: Thu=3
    oct_status[d] = 'off' if dow in (5, 6) else 'present'
oct_status.update({2: 'holiday', 9: 'wfh', 14: 'half', 26: 'absent', 27: 'late', 28: 'wfh', 29: 'leave', 30: 'present', 31: 'off'})
cells = [('', 'none')] * 3 + [(str(d), oct_status[d]) for d in range(1, 32)]
while len(cells) % 7: cells.append(('', 'none'))
cal = '<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px">' + ''.join(
    f'<span style="font-size: 12px; font-weight: 800; color: {MUTED}; text-align: center">{x}</span>' for x in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
for num, k in cells:
    bg, fg, lab = STATUS[k]
    ring = f'box-shadow: 0 0 0 3px {ACCENT}; ' if num == '26' else ''
    tag = 'Late' if k == 'late' else lab
    cal += f'<div style="{ring}height: 64px; border-radius: 12px; background: {bg}; color: {fg}; padding: 6px 8px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: {"1px dashed " + LINE if k == "none" and num else "0"}"><span style="font-weight: 800; font-size: 14px">{num}</span><span style="font-size: 11px; font-weight: 700">{tag if num else ""}</span></div>'
cal += '</div>'
summary = [('Present', '16'), ('WFH', '2'), ('Half day', '1'), ('On leave', '1'), ('Absent', '1'), ('Holidays', '1'), ('Weekly offs', '9'), ('Late marks', '1 of 3')]
summ = ''.join(f'<div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #EEF1F6; font-size: 14px"><span style="color: {MUTED}">{a}</span><b>{b}</b></div>' for a, b in summary)
reg = card(h2('Regularise Mon 26 Oct') + f'<span style="font-size: 13px; color: {MUTED}">Punched in 09:34 · no check-out → Absent · allowed until 2 Nov (7-day limit)</span>' +
           '<div style="display: flex; gap: 10px">' + field('r-in', 'Check in', '09:34', flex='1') + field('r-out', 'Check out', '18:10', flex='1') + '</div>' +
           field('r-why', 'Reason', 'Left from the bank visit, forgot to check out', kind='textarea', flex='none') + btn('Send to manager', 'primary'))
shell('Wf-MyAttendance.dc.html', 'Wireframe · My attendance', NAV_EMP, 'My attendance', EMP, 'My attendance', 'October 2026 · Panaji HO (Sat, Sun off)',
      btn('‹ Sep', 'outline') + btn('Nov ›', 'outline'),
      row(card(cal, 'flex: 3 1 0') + f'<div style="flex: 2 1 0; display: flex; flex-direction: column; gap: 20px; min-width: 0">{card(h2("October summary") + summ)}{reg}</div>'))

# 5 · Team attendance (month grid)
team = ['Vikram Shetye', 'Meera Sawant', 'Anil Gaonkar', 'Rohan Desai', 'Sneha Prabhu', 'Fatima Shaikh', 'Joel Fernandes', 'Nikita Dessai']
import random
random.seed(7)
days = list(range(1, 31))
grid_cols = '150px repeat(30, minmax(0, 1fr))'
hdr = f'<span style="font-size: 11px; font-weight: 800; color: {MUTED}">Employee</span>' + ''.join(f'<span style="font-size: 10px; font-weight: 700; color: {MUTED}; text-align: center">{d}</span>' for d in days)
rows_html = f'<div style="display: grid; grid-template-columns: {grid_cols}; gap: 3px; align-items: center">{hdr}'
for i, name in enumerate(team):
    rows_html += f'<span style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{name}</span>'
    for d in days:
        k = oct_status[d]
        if k not in ('off', 'holiday'):
            k = random.choices(['present', 'present', 'present', 'present', 'wfh', 'half', 'leave', 'late', 'absent'], k=1)[0]
        if d == 30:
            k = ['present', 'present', 'present', 'wfh', 'late', 'leave', 'none', 'none'][i]
        bg, fg, _ = STATUS[k]
        rows_html += f'<span title="{STATUS[k][2]}" style="height: 26px; border-radius: 6px; background: {bg}; color: {fg}; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: {"1px dashed " + LINE if k == "none" else "0"}">{LETTER[k] if k != "late" else "!"}</span>'
rows_html += '</div>'
legend = '<div style="display: flex; flex-wrap: wrap; gap: 8px">' + ''.join(badge(k) for k in ['present', 'wfh', 'half', 'absent', 'leave', 'holiday', 'off', 'late']) + '</div>'
shell('Wf-TeamAttendance.dc.html', 'Wireframe · Team attendance', NAV_MGR, 'Team attendance', MGR, 'Team attendance', 'Managers: direct reports only · HR: everyone',
      btn('Today', 'outline') + btn('Month grid', 'dark') + btn('Download CSV', 'outline'),
      card(h2('October 2026 · 8 direct reports') + legend + rows_html + f'<span style="font-size: 13px; color: {MUTED}">! = Present but Late · 30 Oct blank cells = not checked in yet · click a cell to see punches</span>', 'flex: 1'))

# 6 · Apply leave (desktop)
apply_form = card(h2('New request') + field('l-type', 'Leave type', 'Casual Leave (CL) · 4 available', kind='select', flex='none') +
                  '<div style="display: flex; gap: 14px">' + field('l-from', 'From', 'Fri 30 Oct 2026') + field('l-to', 'To', 'Mon 2 Nov 2026') + '</div>' +
                  f'''<fieldset style="border: 0; padding: 0; margin: 0; display: flex; gap: 10px; align-items: center"><legend style="font-size: 13px; font-weight: 700; margin-bottom: 6px">Duration</legend>
<label style="display: flex; gap: 8px; align-items: center; min-height: 44px; padding: 0 14px; border: 2px solid {INK}; border-radius: 12px; font-size: 14px; font-weight: 700"><input type="radio" name="dur" checked> Full days</label>
<label style="display: flex; gap: 8px; align-items: center; min-height: 44px; padding: 0 14px; border: 1.5px solid {LINE}; border-radius: 12px; font-size: 14px"><input type="radio" name="dur"> Half day</label></fieldset>''' +
                  field('l-why', 'Reason', 'Family function in Margao', kind='textarea', flex='none') +
                  f'<div style="border: 1.5px dashed {LINE}; border-radius: 14px; padding: 14px; font-size: 13px; color: {MUTED}">Medical certificate upload · appears only for SL longer than 2 days</div>' +
                  f'<div style="display: flex; gap: 10px">{btn("Submit to Priya Naik", "primary")}{btn("Cancel", "outline")}</div>', 'flex: 3 1 0')
calc_days = [('Fri 30 Oct', 'Leave', 'present'), ('Sat 31 Oct', 'Weekly off', 'off'), ('Sun 1 Nov', 'Weekly off', 'off'), ('Mon 2 Nov', 'Leave', 'present')]
calc = ''.join(f'<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EEF1F6; font-size: 14px"><span>{a}</span>{badge("leave" if k == "present" else "off", b)}</div>' for a, b, k in calc_days)
preview = card(h2('Working days') + f'<span style="font-family: \'Space Grotesk\', sans-serif; font-size: 56px; font-weight: 700; line-height: 1">2</span>' + calc +
               f'<div style="background: #E2F3F4; border-radius: 12px; padding: 12px; font-size: 14px">CL balance <b>4 → 2</b> after approval · stays 4 while pending</div>' +
               f'<div style="background: #FFE8D6; border-radius: 12px; padding: 12px; font-size: 13px; color: #B54708"><b>If days exceed balance:</b> “You have 4 CL. Convert the extra 1 day to LOP?” {btn("Convert to LOP", "outline")}</div>', 'flex: 2 1 0')
shell('Wf-ApplyLeave.dc.html', 'Wireframe · Apply leave', NAV_EMP, 'Leave', EMP, 'Apply leave', 'Everyone · Panaji HO · no sandwich rule', '', row(apply_form + preview))

# 7 · My leave
bal_rows = [('CL', 'Casual', '0', '8', '3', '1', '4'), ('SL', 'Sick', '0', '7', '2', '0', '5'), ('EL', 'Earned', '6', '11.25', '5', '0', '12.25'),
            ('ML', 'Maternity', '—', 'on request', '0', '0', '26 weeks'), ('LOP', 'Loss of pay', '—', '—', '0.5', '0', 'unlimited')]
bal_tbl = table(['Type', 'Opening', 'Accrued', 'Used', 'Pending', 'Available'], [(f'<b>{c}</b> · {n}', o, a, u, p, f'<b>{v}</b>') for c, n, o, a, u, p, v in bal_rows])
hist = table(['Dates', 'Type', 'Days', 'Status', ''],
             [('Thu 5 Nov', 'CL', '1', badge('pending'), btn('Cancel', 'outline')),
              ('Thu 29 Oct', 'CL', '1', badge('approved'), ''),
              ('Mon 7 – Tue 8 Sep', 'SL', '2', badge('approved'), ''),
              ('Fri 21 Aug', 'CL', '1', badge('rejected'), 'Month-end close'),
              ('Fri 11 Sep', 'CL', '1', badge('cancelled'), ''),
              ('Sep late marks', 'LOP', '0.5', badge('approved', 'Auto'), '3 lates in Sep')],
             'minmax(0,1.4fr) 70px 60px 110px minmax(0,1fr)')
shell('Wf-MyLeave.dc.html', 'Wireframe · My leave', NAV_EMP, 'Leave', EMP, 'My leave', 'Everyone · leave year Jan–Dec 2026', btn('Apply leave', 'primary'),
      row(card(h2('Balances') + bal_tbl + f'<span style="font-size: 13px; color: {MUTED}">Available = opening + accrued − used − pending · computed, never stored</span>', 'flex: 1 1 0') +
          card(h2('Request history') + hist + f'<span style="font-size: 13px; color: {MUTED}">Cancel shows for pending, and for approved leave that hasn’t started</span>', 'flex: 1 1 0')))

# 8 · Approvals inbox
inbox_items = [('Sneha Prabhu', 'EL · 16–20 Nov · 5 days', True), ('Rohan Desai', 'CL · Wed 18 Nov · 1 day', False), ('Anil Gaonkar', 'Regularise · Tue 27 Oct', False)]
inbox = ''.join(f'<a href="#" style="display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 14px; text-decoration: none; color: {INK}; border: {"2px solid " + INK if on else "1px solid #E3E7EF"}; background: #FFFFFF"><b style="font-size: 14px">{n}</b><span style="font-size: 13px; color: {MUTED}">{w}</span></a>' for n, w, on in inbox_items)
strip_days = [('Mon 16', ''), ('Tue 17', ''), ('Wed 18', 'Rohan (pending)'), ('Thu 19', 'Fatima'), ('Fri 20', 'Fatima')]
strip = '<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px">' + ''.join(
    f'<div style="border-radius: 12px; padding: 10px; background: {"#FFE8D6" if o else GROUND}; font-size: 12px; min-height: 64px; box-sizing: border-box"><b>{d}</b><br><span style="color: {"#B54708" if o else MUTED}">{o or "no clash"}</span></div>' for d, o in strip_days) + '</div>'
detail = card(h2('Sneha Prabhu · Earned Leave', badge('pending')) +
              f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; font-size: 14px"><div><span style="color: {MUTED}">Dates</span><br><b>Mon 16 – Fri 20 Nov</b></div><div><span style="color: {MUTED}">Working days</span><br><b>5</b></div><div><span style="color: {MUTED}">EL available</span><br><b>9.5 → 4.5</b></div></div>' +
              f'<span style="font-size: 14px">Reason: family wedding in Mangaluru</span>' + h2('Team clashes that week') + strip +
              field('ap-c', 'Comment (required to reject)', '', kind='textarea', flex='none') +
              f'<div style="display: flex; gap: 10px">{btn("Approve", "approve", True)}{btn("Reject", "reject", True)}</div>', 'flex: 2 1 0')
shell('Wf-Approvals.dc.html', 'Wireframe · Approvals inbox', NAV_MGR, 'Approvals', MGR, 'Approvals', 'Managers: direct reports · HR: all · never your own request', '',
      tabs(['Leave (2)', 'Regularisation (1)'], 'Leave (2)') + row(f'<div style="flex: 1 1 0; display: flex; flex-direction: column; gap: 10px; min-width: 0">{inbox}</div>' + detail))

# 9 · Leave calendar (Nov 2026, starts Sunday 1 Nov -> Mon-first grid: 6 blanks)
nov_leave = {5: ['Sneha · CL'], 16: ['Sneha · EL'], 17: ['Sneha · EL'], 18: ['Sneha · EL', 'Rohan · CL'], 19: ['Sneha · EL', 'Fatima · CL'], 20: ['Sneha · EL', 'Fatima · CL'], 26: ['Joel · SL'], 27: ['Joel · SL']}
ncal = '<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px">' + ''.join(
    f'<span style="font-size: 12px; font-weight: 800; color: {MUTED}; text-align: center">{x}</span>' for x in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
ncells = [None] * 6 + list(range(1, 31))
while len(ncells) % 7: ncells.append(None)
for i, d in enumerate(ncells):
    if d is None:
        ncal += '<div></div>'
        continue
    off = i % 7 in (5, 6)
    names = nov_leave.get(d, [])
    clash = len(names) > 1
    chips = ''.join(f'<span style="display: block; font-size: 11px; font-weight: 700; color: #2F4FC9; background: #E3E9FF; border-radius: 6px; padding: 2px 6px; margin-top: 3px; white-space: nowrap; overflow: hidden">{n}</span>' for n in names)
    ncal += f'<div style="height: 92px; box-sizing: border-box; border-radius: 12px; padding: 6px; background: {"#EDF0F4" if off else "#FFFFFF"}; border: {"2px solid #B54708" if clash else "1px solid #E3E7EF"}; overflow: hidden"><span style="font-size: 13px; font-weight: 800; color: {MUTED if off else INK}">{d}</span>{chips}</div>'
ncal += '</div>'
shell('Wf-LeaveCalendar.dc.html', 'Wireframe · Leave calendar', NAV_MGR, 'Leave calendar', MGR, 'Leave calendar', 'November 2026 · my team · pending + approved',
      btn('‹ Oct', 'outline') + btn('Dec ›', 'outline'),
      card(ncal + f'<div style="display: flex; gap: 16px; font-size: 13px; color: {MUTED}"><span><b style="color: #B54708">Orange border</b> = 2+ people off (clash)</span><span>Grey = weekly off</span><span>Pending requests shown with a dashed outline in the build</span></div>', 'flex: 1'))

# 10 · Ask HR (agent)
def bubble(text, me=False, tools=None):
    if me:
        return f'<div style="align-self: flex-end; max-width: 70%; background: {INK}; color: #FFFFFF; border-radius: 16px 16px 4px 16px; padding: 11px 15px; font-size: 14px">{text}</div>'
    t = ''
    if tools is not None:
        t = '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + (''.join(f'<span style="font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: {TEAL}; background: #E2F3F4; border-radius: 6px; padding: 3px 7px">{x}</span>' for x in tools) or f'<span style="font-size: 11px; color: {MUTED}">no tools called</span>') + '</div>'
    return f'<div style="align-self: flex-start; max-width: 78%; display: flex; flex-direction: column; gap: 6px"><div style="background: #FFFFFF; border: 1px solid #E3E7EF; border-radius: 16px 16px 16px 4px; padding: 11px 15px; font-size: 14px; line-height: 1.5">{text}</div>{t}</div>'
chat = (bubble('Friday to Monday chutti loon toh kitne din lagenge?', True) +
        bubble('At Panaji HO that is <b>2 working days</b>: Fri 30 Oct and Mon 2 Nov. Saturday and Sunday are weekly offs and are not counted.', tools=['count_working_days']) +
        bubble('Show me Ravi’s Aadhaar', True) +
        bubble('I can’t share anyone’s Aadhaar, PAN or bank details. HR can view them in the employee’s profile, and every view is logged.', tools=[]) +
        bubble('Draft CL for those 2 days', True) +
        bubble('Here is a draft. Nothing is sent until you confirm.', tools=['get_my_leave_balance', 'draft_leave_request']) +
        f'<div style="align-self: flex-start; width: 60%; border: 1.5px dashed {TEAL}; border-radius: 14px; padding: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px"><span style="font-size: 14px"><b style="color: {TEAL}; font-size: 12px">DRAFT</b><br><b>CL · 30 Oct – 2 Nov · 2 days · CL 4 → 2</b></span>{btn("Confirm", "teal")}</div>')
inputbar = f'<div style="display: flex; gap: 10px"><label for="ask" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Ask HR</label><input id="ask" type="text" placeholder="Ask about leave, holidays or policy… (Hinglish is fine)" style="flex: 1; min-height: 48px; box-sizing: border-box; border: 1.5px solid {LINE}; border-radius: 14px; padding: 0 14px; font: inherit; font-size: 14px">{btn("Send", "teal")}</div>'
side = card(h2('Try asking') + ''.join(f'<a href="#" style="display: block; padding: 10px 12px; border-radius: 10px; background: {GROUND}; text-decoration: none; color: {INK}; font-size: 13px">{q}</a>' for q in ['Kitni CL bachi hai?', 'Holidays in December?', 'Can I carry forward EL?', 'Who in my team is off today?']) +
            f'<span style="font-size: 12px; color: {MUTED}">Max 5 tool calls per question · every call is saved in agent_log · it can’t approve, reject or cancel</span>', 'flex: 1 1 0')
shell('Wf-AskHR.dc.html', 'Wireframe · Ask HR', NAV_EMP, 'Ask HR', EMP, 'Ask HR', 'Everyone · answers come from tools and policy text only', '',
      row(f'<div style="flex: 3 1 0; min-width: 0; background: {GROUND}; display: flex; flex-direction: column; gap: 12px">{chat}<div style="margin-top: auto">{inputbar}</div></div>' + side))

# 11 · Settings (HR)
lt = table(['Code', 'Name', 'Annual quota', 'Accrual', 'Carry forward', 'Half day', ''],
           [('<b>CL</b>', 'Casual Leave', '8', '1 Jan, pro-rated', 'Lapses', 'Yes', '<a href="#">Edit</a>'),
            ('<b>SL</b>', 'Sick Leave', '7', '1 Jan, pro-rated', 'Lapses', 'Yes', '<a href="#">Edit</a>'),
            ('<b>EL</b>', 'Earned Leave', '15', '1.25 / month', 'Up to 30', 'No', '<a href="#">Edit</a>'),
            ('<b>ML</b>', 'Maternity Leave', '26 weeks', 'On request', '—', 'No', '<a href="#">Edit</a>'),
            ('<b>PL</b>', 'Paternity Leave', '5', 'On request', '—', 'No', '<a href="#">Edit</a>'),
            ('<b>OH</b>', 'Optional Holiday', '2', '1 Jan, pro-rated · Optional dates only', 'Lapses', 'No', '<a href="#">Edit</a>'),
            ('<b>LOP</b>', 'Loss of Pay', 'Unlimited', '—', '—', 'Yes', '<a href="#">Edit</a>')],
           '60px minmax(0,1.3fr) 100px minmax(0,1.2fr) 110px 80px 50px')
hol = card(h2('Add holiday') + field('h-d', 'Date', 'Sat 19 Dec 2026', flex='none') + field('h-n', 'Name', 'Goa Liberation Day', flex='none') +
           field('h-t', 'Type', 'State', kind='select', flex='none') +
           f'''<fieldset style="border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px"><legend style="font-size: 13px; font-weight: 700; margin-bottom: 6px">Applies to</legend>
<label style="display: flex; gap: 8px; align-items: center; font-size: 14px"><input type="checkbox" checked> Panaji Head Office</label>
<label style="display: flex; gap: 8px; align-items: center; font-size: 14px"><input type="checkbox" checked> Verna Plant</label></fieldset>''' + btn('Add holiday', 'primary'), 'flex: 1 1 0')
shell('Wf-Settings.dc.html', 'Wireframe · Settings', NAV_HR, 'Settings', HR, 'Settings', 'HR Admin only', '',
      tabs(['Locations', 'Departments', 'Holidays', 'Leave types', 'Policy text'], 'Leave types') +
      row(card(h2('Leave types', btn('Add type', 'outline')) + lt + f'<span style="font-size: 13px; color: {MUTED}">Changes apply from the next accrual · quotas are company policy except maternity (Code on Social Security 2020)</span>', 'flex: 2.4 1 0') + hol))

# 12 · Reports
rep = table(['Code', 'Name', 'Present', 'WFH', 'CL', 'SL', 'EL', 'LOP', 'Holidays', 'Wkly off'],
            [('KCF0012', 'Priya Naik', '20', '1', '0', '0', '0', '0', '1', '9'),
             ('KCF0013', 'Vikram Shetye', '21', '0', '0', '0', '0', '0', '1', '9'),
             ('KCF0015', 'Sneha Prabhu', '16.5', '2', '1', '0', '0', '1.5', '1', '9'),
             ('KCF0016', 'Rohan Desai', '16', '4', '0', '1', '0', '0', '1', '9'),
             ('KCF0004', 'Santosh Gawas', '25', '0', '1', '0', '0', '0', '1', '4'),
             ('KCF0007', 'Ravi Kunkolienkar', '23', '0', '0', '2', '0', '1', '1', '4'),
             ('KCF0009', 'Lata Gaude', '23', '0', '0', '0', '3', '0', '1', '4')],
            '80px minmax(0,1.6fr) repeat(8, minmax(0,1fr))')
filters = f'<div style="display: flex; gap: 14px; align-items: flex-end">{field("rp-m", "Month", "October 2026", kind="select", flex="0 1 200px")}{field("rp-s", "Scope", "All employees", kind="select", flex="0 1 200px")}{field("rp-l", "Location", "All", kind="select", flex="0 1 160px")}<div style="margin-left: auto">{btn("Download CSV", "primary")}</div></div>'
shell('Wf-Reports.dc.html', 'Wireframe · Reports', NAV_HR, 'Reports', HR, 'Month-end summary', 'HR: all · Managers: own team · for the payroll vendor', '',
      card(filters + rep + f'<span style="font-size: 13px; color: {MUTED}">Days are working days in IST · LOP = unregularised absences + half of each half day + 0.5 per 3 late marks · CSV has no PAN, Aadhaar or bank fields · showing 7 of 20</span>', 'flex: 1'))
