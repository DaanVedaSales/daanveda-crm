#!/usr/bin/env python3
"""
DaanVeda CRM — SQL Migration Generator
Reads Excel files locally and generates INSERT SQL statements.
The SQL file is then executed via Supabase MCP.

Usage: python3 scripts/generate_migration_sql.py
Output: /tmp/migration_inserts.sql  (and /tmp/migration_skipped.txt)
"""
import re, json, uuid, warnings
from pathlib import Path
from datetime import datetime

warnings.filterwarnings('ignore')

import pandas as pd
from dateutil import parser as dateutil_parser

# ── File Paths ────────────────────────────────────────────────────────────────
CONVERTED_FILE = Path.home() / 'Downloads/Converted_Clients_May_2026.xlsx'
CLOSER_FILE    = Path.home() / 'Downloads/Closer_Pipeline_Template.xlsx'
SDR_FILE       = Path.home() / 'Downloads/SDR_Leads_Final.xlsx'
DB_ORGS_FILE   = Path('/tmp/db_orgs.json')
DB_DEALS_FILE  = Path('/tmp/db_orgs_with_deals.json')
OUTPUT_SQL     = Path('/tmp/migration_inserts.sql')
SKIPPED_FILE   = Path('/tmp/migration_skipped.txt')

# ── User ID Maps ──────────────────────────────────────────────────────────────
ADMIN_ID = 'e34100a2-8ba7-402e-b3de-20605fb4e7b3'

SDR_MAP = {
    'anshika':       '67d623fb-0f88-4cbc-b95a-03622b725290',
    'harshit':       'aa1cb6ab-9a35-4293-9463-af5b596a1ccd',
    'laxmi':         'b5f939d3-dbf9-4296-9696-8bfa4c873551',
    'pratibha':      'f08ae5e0-08c0-4d38-839e-1af8e24e9002',
    'pratibha priya':'f08ae5e0-08c0-4d38-839e-1af8e24e9002',
    'irfan':         'a5852c5c-a540-4b29-966e-34d676f806ad',
    'anurag':        '8442d563-3df3-4954-b6c4-67bd611ad4fa',
    'himanshu':      'ddc7f2da-2dd9-4b00-8553-88997562a96b',
    'kaif':          '31075adf-da69-41b0-8bc1-b28cf1547d73',
    'megha':         '9acc6922-902a-427a-a6cc-354a25bbea89',
    'muskan':        'ddc3402e-f672-42f9-b4a7-a7adcf39362f',
}
CLOSER_MAP = {
    'anurag':   '8442d563-3df3-4954-b6c4-67bd611ad4fa',
    'himanshu': 'ddc7f2da-2dd9-4b00-8553-88997562a96b',
    'irfan':    'a5852c5c-a540-4b29-966e-34d676f806ad',
    'kaif':     '31075adf-da69-41b0-8bc1-b28cf1547d73',
    'megha':    '9acc6922-902a-427a-a6cc-354a25bbea89',
    'muskan':   'ddc3402e-f672-42f9-b4a7-a7adcf39362f',
}
UNASSIGNED = {'himani', 'keerthana', 'sdr', 'not in sdr file', 'kaif'}

# ── SQL Helpers ───────────────────────────────────────────────────────────────
def q(val):
    """Escape a string value for SQL. Returns NULL or 'escaped string'."""
    if val is None:
        return 'NULL'
    s = str(val).replace("'", "''")
    return f"'{s}'"

def qn(val):
    """Return numeric SQL literal or NULL."""
    if val is None:
        return 'NULL'
    return str(val)

def qb(val):
    """Return boolean SQL literal."""
    return 'TRUE' if val else 'FALSE'

def qa(lst):
    """Return Postgres array literal from a Python list."""
    if not lst:
        return "ARRAY[]::text[]"
    escaped = [s.replace("'", "''") for s in lst]
    inner = ', '.join(f"'{e}'" for e in escaped)
    return f"ARRAY[{inner}]"

def new_uuid():
    return str(uuid.uuid4())

# ── Value Coercion ────────────────────────────────────────────────────────────
def sv(val):
    if val is None: return None
    if isinstance(val, float) and val != val: return None
    v = str(val).strip()
    return v if v and v.lower() not in ('nan', 'none', 'n/a', '-', '') else None

def numeric(val):
    raw = sv(val)
    if not raw: return None
    try:
        return float(raw.replace(',', '').replace('₹', '').replace(' ', ''))
    except Exception:
        return None

def safe_int(val):
    v = numeric(val)
    return int(v) if v is not None else None

def deal_val(val):
    v = numeric(val)
    if v is None: return None
    return None if v > 10_000_000 or v < 30_000 else v

def parse_iso(val, fallback=None):
    raw = sv(val)
    if not raw: return fallback
    try:
        if isinstance(val, datetime): return val.isoformat()
        return dateutil_parser.parse(raw).isoformat()
    except Exception:
        return fallback

def parse_date_only(val):
    raw = sv(val)
    if not raw: return None
    try:
        if isinstance(val, datetime): return val.strftime('%Y-%m-%d')
        return dateutil_parser.parse(raw).strftime('%Y-%m-%d')
    except Exception:
        return None

def thematic_list(val):
    raw = sv(val)
    if not raw: return []
    return [p.strip() for p in re.split(r'[,;|/]+', raw) if p.strip()]

def map_sdr(name_val):
    raw = sv(name_val)
    if not raw: return None
    return SDR_MAP.get(raw.lower().strip(), None)

def map_closer(name_val):
    raw = sv(name_val)
    if not raw: return None
    return CLOSER_MAP.get(raw.lower().strip(), None)

def map_deal_stage(val):
    raw = sv(val)
    if not raw: return 'demo_done'
    return {'demo_done':'demo_done','follow_up':'follow_up','negotiation':'negotiation',
            'proposal_sent':'proposal_sent','won':'won','lost':'lost',
            'ghosted':'ghosted','converted':'converted','unqualified':'unqualified'
            }.get(raw.lower(), 'demo_done')

def map_demo_status(val):
    raw = sv(val)
    if not raw: return 'attended'
    r = raw.lower()
    return 'no_show' if ('not shown' in r or 'no show' in r or 'no_show' in r) else 'attended'

def map_sdr_status(val):
    raw = sv(val)
    if not raw: return 'new'
    return {'new':'new','contacted':'call_again','call_again':'call_again',
            'follow_up':'call_again','interested':'hot','invalid_contact':'not_reachable',
            'not_reachable':'not_reachable','hot':'hot'}.get(raw.lower().strip(), 'new')

def map_interest_signal(val):
    raw = sv(val)
    if not raw: return None
    r = raw.lower()
    return r if r in ('hot','warm','cold','dead') else None

def map_activity_type(val):
    raw = sv(val)
    if not raw: return 'note'
    return {'call':'call','email':'email','linkedin':'linkedin',
            'whatsapp':'whatsapp','note':'note'}.get(raw.lower(), 'note')

def map_lead_type(val):
    raw = sv(val)
    return raw if raw in ('Inbound','Outbound','Referral') else 'Outbound'

# ── Closer Notes Parser ───────────────────────────────────────────────────────
MONTH_NUM = {'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
             'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}

def _infer_year(m): return 2026 if m <= 5 else 2025

def _parse_note_date(token):
    token = token.strip()
    m = re.match(r'^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)', token, re.IGNORECASE)
    if m:
        day, mon = int(m.group(1)), m.group(2).lower()[:3]
        if mon in MONTH_NUM:
            mo = MONTH_NUM[mon]
            try: return datetime(_infer_year(mo), mo, min(day, 28))
            except: pass
    m = re.match(r'^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?', token, re.IGNORECASE)
    if m:
        mon, day = m.group(1).lower()[:3], int(m.group(2))
        if mon in MONTH_NUM:
            mo = MONTH_NUM[mon]
            try: return datetime(_infer_year(mo), mo, min(day, 28))
            except: pass
    return datetime.now()

def parse_closer_notes(text, deal_id, closer_id, deal_stage_str):
    raw = sv(text)
    if not raw: return []
    comments = []
    parts = re.split(r'\s+/\s+|\n', raw)
    for part in parts:
        part = part.strip()
        if not part: continue
        dm = re.match(
            r'^((?:\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+|[a-zA-Z]+\s+\d{1,2}(?:st|nd|rd|th)?))\s*:?\s+',
            part, re.IGNORECASE
        )
        if dm:
            parsed_dt = _parse_note_date(dm.group(1))
            comment_text = part[dm.end():].strip()
        else:
            dm2 = re.match(r'^\d{1,2}(?:st|nd|rd|th)?\s*:\s*', part, re.IGNORECASE)
            comment_text = part[dm2.end():].strip() if dm2 else part
            parsed_dt = datetime.now()
        if comment_text:
            comments.append((deal_id, closer_id, comment_text,
                             deal_stage_str, parsed_dt.strftime('%Y-%m-%dT10:00:00+00:00')))
    return comments

# ── Dedup Closer Pipeline ─────────────────────────────────────────────────────
def preprocess_closer(df):
    df = df.copy()
    df['_key'] = df['org_name'].apply(lambda x: str(x).strip().lower() if pd.notna(x) else '')
    notes_override, drop_idx = {}, []
    for key, grp in df.groupby('_key', sort=False):
        if len(grp) <= 1 or not key: continue
        if 'tfix' in key:
            all_notes = [sv(r['closer_notes']) for _, r in grp.iterrows() if sv(r.get('closer_notes'))]
            notes_override[key] = ' / '.join(filter(None, all_notes))
            drop_idx.extend(grp.index[1:].tolist())
        elif 'sambhav foundation' in key:
            def _dv(r):
                v = numeric(r.get('deal_value')); return v if v else 0
            rows = sorted([(i, _dv(r)) for i, r in grp.iterrows()], key=lambda x: abs(x[1]-46900))
            drop_idx.extend([i for i, _ in rows[1:]])
        else:
            drop_idx.extend(grp.index[1:].tolist())
    df = df.drop(index=drop_idx).reset_index(drop=True).drop(columns=['_key'])
    return df, notes_override

# ── SQL Statement Builders ────────────────────────────────────────────────────
statements = []  # list of SQL strings
skipped    = []  # list of (name, reason) tuples
stats      = {'converted':{'created':0,'skipped':0},'closer':{'created':0,'skipped':0},'sdr':{'created':0,'skipped':0}}

def add(sql):
    statements.append(sql.strip())

def insert_org(org_id, name, location=None, url=None, linkedin=None, thematic=None,
               sql_score=0, annual_revenue=None, team_size=None, age_years=None,
               is_client=False, icp_verified=False):
    add(f"""INSERT INTO organizations (id, name, location, url, linkedin_url, thematic_areas,
  sql_score, annual_revenue, team_size, age_years, is_client, icp_verified)
VALUES ({q(org_id)}, {q(name)}, {q(location)}, {q(url)}, {q(linkedin)}, {qa(thematic or [])},
  {sql_score or 0}, {qn(annual_revenue)}, {qn(team_size)}, {qn(age_years)}, {qb(is_client)}, {qb(icp_verified)});""")

def insert_contact(contact_id, org_id, name, designation=None, phone=None,
                   email=None, linkedin=None, is_primary=True):
    add(f"""INSERT INTO contacts (id, org_id, name, designation, phone, email, linkedin_url, is_primary)
VALUES ({q(contact_id)}, {q(org_id)}, {q(name)}, {q(designation)}, {q(phone)}, {q(email)}, {q(linkedin)}, {qb(is_primary)});""")

def insert_lead(lead_id, org_id, assigned_to, assigned_by, status, phase,
                interest_signal=None, callback_date=None, follow_up_date=None, lead_type='Outbound'):
    add(f"""INSERT INTO leads (id, org_id, assigned_to, assigned_by, status, phase,
  interest_signal, callback_date, follow_up_date, lead_type)
VALUES ({q(lead_id)}, {q(org_id)}, {q(assigned_to)}, {q(assigned_by)}, '{status}', '{phase}',
  {q(interest_signal)}, {q(callback_date)}, {q(follow_up_date)}, '{lead_type}');""")

def insert_demo(demo_id, lead_id, org_id, sdr_id, closer_id, demo_date,
                sdr_summary, pain_point=None, demo_expectation=None,
                interest_signal=None, status='attended'):
    add(f"""INSERT INTO demos (id, lead_id, org_id, sdr_id, closer_id, demo_date,
  sdr_summary, pain_point, demo_expectation, sdr_interest_signal, status)
VALUES ({q(demo_id)}, {q(lead_id)}, {q(org_id)}, {q(sdr_id)}, {q(closer_id)}, {q(demo_date)},
  {q(sdr_summary)}, {q(pain_point)}, {q(demo_expectation)}, {q(interest_signal)}, '{status}');""")

def insert_deal(deal_id, demo_id, lead_id, org_id, closer_id, stage,
                deal_value=None, plan_type=None, next_follow_up=None, loss_reason=None,
                billing_name=None, billing_address=None, gst_number=None,
                poc_name=None, poc_designation=None, poc_phone=None, poc_email=None):
    add(f"""INSERT INTO deals (id, demo_id, lead_id, org_id, closer_id, stage,
  deal_value, plan_type, next_follow_up, loss_reason,
  billing_name, billing_address, gst_number,
  poc_name, poc_designation, poc_phone, poc_email)
VALUES ({q(deal_id)}, {q(demo_id)}, {q(lead_id)}, {q(org_id)}, {q(closer_id)}, '{stage}',
  {qn(deal_value)}, {q(plan_type)}, {q(next_follow_up)}, {q(loss_reason)},
  {q(billing_name)}, {q(billing_address)}, {q(gst_number)},
  {q(poc_name)}, {q(poc_designation)}, {q(poc_phone)}, {q(poc_email)});""")

def insert_deal_comment(comment_id, deal_id, user_id, comment, deal_stage, created_at):
    add(f"""INSERT INTO deal_comments (id, deal_id, user_id, comment, deal_stage, created_at)
VALUES ({q(comment_id)}, {q(deal_id)}, {q(user_id)}, {q(comment)}, '{deal_stage}', '{created_at}');""")

def insert_activity(act_id, lead_id, org_id, user_id, activity_type, outcome, notes, created_at):
    add(f"""INSERT INTO activities (id, lead_id, org_id, user_id, activity_type, outcome, notes, created_at)
VALUES ({q(act_id)}, {q(lead_id)}, {q(org_id)}, {q(user_id)}, '{activity_type}',
  {q(outcome)}, {q(notes)}, {q(created_at)});""")

# ── Load DB State ─────────────────────────────────────────────────────────────
print("Loading DB state from local cache...")
db_orgs_raw = json.load(open(DB_ORGS_FILE))
orgs_with_deals = set(json.load(open(DB_DEALS_FILE)))

# Build lookup: lower_name → existing_org_id
org_by_name = {k: v['id'] for k, v in db_orgs_raw.items()}
client_orgs  = {k for k, v in db_orgs_raw.items() if v['is_client']}
print(f"  {len(org_by_name)} orgs, {len(client_orgs)} clients, {len(orgs_with_deals)} orgs with deals")

# ── FILE 1: Converted Clients ─────────────────────────────────────────────────
print("\nProcessing Converted Clients...")
df_converted = pd.read_excel(CONVERTED_FILE)
now_iso = datetime.now().isoformat()
converted_org_names = set()

for _, row in df_converted.iterrows():
    org_name = sv(row.iloc[0])
    if not org_name: continue
    org_key = org_name.strip().lower()
    converted_org_names.add(org_key)

    if org_key in client_orgs:
        skipped.append((org_name, 'already is_client in DB'))
        stats['converted']['skipped'] += 1
        continue

    org_id = org_by_name.get(org_key) or new_uuid()
    if org_key not in org_by_name:
        insert_org(org_id, org_name, sv(row.iloc[1]), sv(row.iloc[2]), sv(row.iloc[3]),
                   thematic_list(row.iloc[4]), is_client=True, icp_verified=True)
        org_by_name[org_key] = org_id
    else:
        # Update existing org to is_client
        add(f"UPDATE organizations SET is_client=TRUE, icp_verified=TRUE WHERE id={q(org_id)};")

    contact_name = sv(row.iloc[5])
    if contact_name:
        insert_contact(new_uuid(), org_id, contact_name, sv(row.iloc[6]),
                       sv(row.iloc[7]), sv(row.iloc[8]), sv(row.iloc[9]))

    sdr_name_raw = sv(row.iloc[10])
    sdr_id = (map_sdr(sdr_name_raw) if sdr_name_raw and sdr_name_raw.lower() != 'not in sdr file'
              else None) or ADMIN_ID
    closer_id = map_closer(row.iloc[11]) or ADMIN_ID
    conv_date = parse_iso(row.iloc[12], fallback=now_iso)

    lead_id = new_uuid()
    insert_lead(lead_id, org_id, closer_id, ADMIN_ID, 'converted', 'converted')
    demo_id = new_uuid()
    insert_demo(demo_id, lead_id, org_id, sdr_id, closer_id, conv_date,
                'Historical converted client — demo pre-dated the CRM system.')
    deal_id = new_uuid()
    insert_deal(deal_id, demo_id, lead_id, org_id, closer_id, 'converted',
                deal_value=deal_val(row.iloc[13]), plan_type=sv(row.iloc[14]),
                billing_name=sv(row.iloc[15]))

    stats['converted']['created'] += 1
    print(f"  OK  {org_name}")

# ── FILE 2: Closer Pipeline ───────────────────────────────────────────────────
print(f"\nProcessing Closer Pipeline...")
df_closer_raw = pd.read_excel(CLOSER_FILE)
df_closer, notes_override = preprocess_closer(df_closer_raw)
closer_org_names = set()

for _, row in df_closer.iterrows():
    org_name = sv(row.get('org_name'))
    if not org_name: continue
    org_key = org_name.strip().lower()

    if org_key in converted_org_names:
        skipped.append((org_name, 'in Converted Clients — skip from pipeline'))
        stats['closer']['skipped'] += 1
        continue
    if org_key in orgs_with_deals:
        skipped.append((org_name, 'already has active deal in DB'))
        stats['closer']['skipped'] += 1
        continue

    sdr_id    = map_sdr(row.get('sdr_name')) or ADMIN_ID
    closer_id = map_closer(row.get('closer_name')) or ADMIN_ID

    org_id = org_by_name.get(org_key)
    if not org_id:
        org_id = new_uuid()
        insert_org(org_id, org_name, sv(row.get('org_location')), sv(row.get('org_website')),
                   sv(row.get('org_linkedin')), thematic_list(row.get('org_thematic_areas')),
                   safe_int(row.get('org_sql_score')) or 0,
                   numeric(row.get('org_annual_revenue')), safe_int(row.get('org_team_size')),
                   safe_int(row.get('org_age_years')))
        org_by_name[org_key] = org_id

    contact_name = sv(row.get('contact_name'))
    if contact_name:
        insert_contact(new_uuid(), org_id, contact_name, sv(row.get('contact_designation')),
                       sv(row.get('contact_phone')), sv(row.get('contact_email')),
                       sv(row.get('contact_linkedin')))

    deal_stage_str = sv(row.get('deal_stage')) or 'Follow_Up'
    db_stage = map_deal_stage(deal_stage_str)
    lead_status = {'demo_done':'demo_done','follow_up':'follow_up','negotiation':'negotiation',
                   'proposal_sent':'proposal_sent','won':'won','lost':'lost','ghosted':'ghosted'
                   }.get(db_stage, 'demo_done')

    lead_id = new_uuid()
    insert_lead(lead_id, org_id, closer_id, ADMIN_ID, lead_status, 'closer')

    demo_date = parse_iso(row.get('demo_date'), fallback=now_iso)
    parts = [sv(row.get('sdr_summary')), sv(row.get('pain_point')), sv(row.get('demo_expectation'))]
    sdr_summary = ' | '.join(filter(None, parts)) or 'Historical demo — context migrated from pre-CRM records.'

    demo_id = new_uuid()
    insert_demo(demo_id, lead_id, org_id, sdr_id, closer_id, demo_date, sdr_summary,
                sv(row.get('pain_point')), sv(row.get('demo_expectation')),
                map_interest_signal(row.get('sdr_interest_signal')),
                map_demo_status(row.get('demo_status')))

    dv = None if 'tfix' in org_key else deal_val(row.get('deal_value'))
    deal_id = new_uuid()
    insert_deal(deal_id, demo_id, lead_id, org_id, closer_id, db_stage,
                deal_value=dv, plan_type=sv(row.get('plan_type')),
                next_follow_up=parse_date_only(row.get('next_follow_up')),
                loss_reason=sv(row.get('loss_reason')),
                billing_name=sv(row.get('billing_name')),
                billing_address=sv(row.get('billing_address')),
                gst_number=sv(row.get('gst_number')),
                poc_name=sv(row.get('poc_name')),
                poc_designation=sv(row.get('poc_designation')),
                poc_phone=sv(row.get('poc_phone')),
                poc_email=sv(row.get('poc_email')))

    notes_text = notes_override.get(org_key) or sv(row.get('closer_notes'))
    for deal_id_, user_id, comment, stage, ts in parse_closer_notes(notes_text, deal_id, closer_id, db_stage):
        insert_deal_comment(new_uuid(), deal_id_, user_id, comment, stage, ts)

    closer_org_names.add(org_key)
    stats['closer']['created'] += 1
    print(f"  OK  {org_name}  [{db_stage}]")

# ── FILE 3: SDR Leads ─────────────────────────────────────────────────────────
print(f"\nProcessing SDR Leads...")
df_sdr = pd.read_excel(SDR_FILE)

for _, row in df_sdr.iterrows():
    org_name = sv(row.get('org_name'))
    if not org_name: continue
    org_key = org_name.strip().lower()

    if org_key in converted_org_names:
        stats['sdr']['skipped'] += 1; continue
    if org_key in closer_org_names:
        stats['sdr']['skipped'] += 1; continue
    if org_key in org_by_name:
        skipped.append((org_name, 'org already in DB lead pool'))
        stats['sdr']['skipped'] += 1; continue

    assigned_raw = sv(row.get('assigned_to'))
    sdr_id = None if (assigned_raw and assigned_raw.lower() in UNASSIGNED) else map_sdr(assigned_raw)

    org_id = new_uuid()
    insert_org(org_id, org_name, sv(row.get('org_location')), sv(row.get('org_website')),
               sv(row.get('org_linkedin')), thematic_list(row.get('org_thematic_areas')),
               safe_int(row.get('org_sql_score')) or 0,
               numeric(row.get('org_annual_revenue')), safe_int(row.get('org_team_size')),
               safe_int(row.get('org_age_years')))
    org_by_name[org_key] = org_id

    contact_name = sv(row.get('contact_name'))
    if contact_name:
        insert_contact(new_uuid(), org_id, contact_name, sv(row.get('contact_designation')),
                       sv(row.get('contact_phone')), sv(row.get('contact_email')),
                       sv(row.get('contact_linkedin')))

    lead_status = map_sdr_status(row.get('lead_status'))
    follow_up = parse_date_only(row.get('follow_up_date'))
    callback  = follow_up if lead_status == 'call_again' else None

    lead_id = new_uuid()
    insert_lead(lead_id, org_id, sdr_id, ADMIN_ID if sdr_id else None,
                lead_status, 'sdr',
                interest_signal=map_interest_signal(row.get('interest_signal')),
                callback_date=callback, follow_up_date=follow_up,
                lead_type=map_lead_type(row.get('lead_type')))

    activity_notes = sv(row.get('last_activity_notes'))
    if activity_notes:
        insert_activity(new_uuid(), lead_id, org_id, sdr_id or ADMIN_ID,
                        map_activity_type(row.get('last_activity_type')),
                        sv(row.get('last_activity_outcome')), activity_notes,
                        parse_iso(row.get('last_activity_date'), fallback=now_iso))

    stats['sdr']['created'] += 1
    print(f"  OK  {org_name}  [{lead_status}]")

# ── Write Output ──────────────────────────────────────────────────────────────
print(f"\nWriting SQL to {OUTPUT_SQL}...")
with open(OUTPUT_SQL, 'w') as f:
    f.write("-- DaanVeda CRM Historical Migration\n")
    f.write(f"-- Generated: {datetime.now()}\n")
    f.write(f"-- Statements: {len(statements)}\n\n")
    for s in statements:
        f.write(s + '\n')

# Write skipped list
sdr_pool_skipped = [(n, r) for n, r in skipped if 'lead pool' in r]
with open(SKIPPED_FILE, 'w') as f:
    for name, reason in skipped:
        f.write(f"{name}  |  {reason}\n")

print(f"\n{'='*60}")
print("  GENERATION SUMMARY")
print(f"{'='*60}")
for key, label in [('converted','Converted Clients'),('closer','Closer Pipeline'),('sdr','SDR Leads')]:
    print(f"  {label:20s}  created: {stats[key]['created']:3d}  skipped: {stats[key]['skipped']:3d}")
print(f"  Total SQL statements generated: {len(statements)}")
print(f"  Total skipped: {len(skipped)}")
print(f"  SDR leads skipped (already in DB): {len(sdr_pool_skipped)}")
print(f"\n  SQL written to: {OUTPUT_SQL}")
print(f"  Skipped list:  {SKIPPED_FILE}")
print(f"{'='*60}")
