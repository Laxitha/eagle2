"""
EAGLE synthetic investigation dataset generator.

Scenario: 3 seemingly unrelated cases that share one hidden connector chain:
    Ravi Kumar (Case FIR-101, narcotics) --phone call-->
    Suresh Reddy (Case FIR-104, financial fraud) --money transfer-->
    Arun Nair (Case FIR-109, vehicle smuggling)

Deliberately injects messy/inconsistent formatting (phone numbers, name
casing/abbreviation, addresses) so downstream normalization and entity
resolution have something real to clean up. Ground truth is written to
ground_truth.md for the team to verify EAGLE's output against.
"""
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)
DATA_DIR = Path(__file__).parent

# ---------------------------------------------------------------------------
# Persons (20) — includes deliberate name-format variants for the same person
# ---------------------------------------------------------------------------
PERSONS = [
    {"id": "P01", "canonical": "Ravi Kumar", "variants": ["Ravi Kumar", "R. Kumar", "RAVI KUMAR", "Shri Ravi Kumar"],
     "phone_canonical": "9876543210", "phone_variants": ["+91 98765 43210", "9876543210", "091-98765-43210"],
     "address": "15 MG Road, Chennai"},
    {"id": "P02", "canonical": "Suresh Reddy", "variants": ["Suresh Reddy", "S. Reddy", "SURESH REDDY", "Suresh R"],
     "phone_canonical": "9123456780", "phone_variants": ["+91 91234 56780", "9123456780", "91234-56780"],
     "address": "22 Banjara Hills, Hyderabad"},
    {"id": "P03", "canonical": "Arun Nair", "variants": ["Arun Nair", "A. Nair", "ARUN NAIR", "Mr. Arun Nair"],
     "phone_canonical": "9988776655", "phone_variants": ["+91 99887 76655", "9988776655", "099887-76655"],
     "address": "8 Marine Drive, Kochi"},
    {"id": "P04", "canonical": "Meena Iyer", "variants": ["Meena Iyer", "M. Iyer", "MEENA IYER"],
     "phone_canonical": "9012345678", "phone_variants": ["+91 90123 45678", "9012345678"],
     "address": "45 T Nagar, Chennai"},
    {"id": "P05", "canonical": "Karthik Subramaniam", "variants": ["Karthik Subramaniam", "K. Subramaniam", "KARTHIK S"],
     "phone_canonical": "9345678901", "phone_variants": ["+91 93456 78901", "9345678901"],
     "address": "3 Anna Nagar, Chennai"},
    {"id": "P06", "canonical": "Farooq Ahmed", "variants": ["Farooq Ahmed", "F. Ahmed", "FAROOQ AHMED"],
     "phone_canonical": "9456789012", "phone_variants": ["+91 94567 89012", "9456789012"],
     "address": "12 Charminar Road, Hyderabad"},
    {"id": "P07", "canonical": "Priya Sharma", "variants": ["Priya Sharma", "P. Sharma", "PRIYA SHARMA"],
     "phone_canonical": "9567890123", "phone_variants": ["+91 95678 90123", "9567890123"],
     "address": "9 Connaught Place, Delhi"},
    {"id": "P08", "canonical": "Vijay Anand", "variants": ["Vijay Anand", "V. Anand", "VIJAY ANAND"],
     "phone_canonical": "9678901234", "phone_variants": ["+91 96789 01234", "9678901234"],
     "address": "17 Koramangala, Bangalore"},
    {"id": "P09", "canonical": "Lakshmi Devi", "variants": ["Lakshmi Devi", "L. Devi", "LAKSHMI DEVI"],
     "phone_canonical": "9789012345", "phone_variants": ["+91 97890 12345", "9789012345"],
     "address": "6 Jubilee Hills, Hyderabad"},
    {"id": "P10", "canonical": "Mohammed Yusuf", "variants": ["Mohammed Yusuf", "Md. Yusuf", "MOHAMMED YUSUF"],
     "phone_canonical": "9890123456", "phone_variants": ["+91 98901 23456", "9890123456"],
     "address": "21 Old City, Hyderabad"},
    {"id": "P11", "canonical": "Deepa Krishnan", "variants": ["Deepa Krishnan", "D. Krishnan", "DEEPA KRISHNAN"],
     "phone_canonical": "9901234567", "phone_variants": ["+91 99012 34567", "9901234567"],
     "address": "5 Fort Kochi, Kochi"},
    {"id": "P12", "canonical": "Rajesh Gupta", "variants": ["Rajesh Gupta", "R. Gupta", "RAJESH GUPTA"],
     "phone_canonical": "9012398765", "phone_variants": ["+91 90123 98765", "9012398765"],
     "address": "30 Karol Bagh, Delhi"},
    {"id": "P13", "canonical": "Anitha Menon", "variants": ["Anitha Menon", "A. Menon", "ANITHA MENON"],
     "phone_canonical": "9123409876", "phone_variants": ["+91 91234 09876", "9123409876"],
     "address": "11 Vyttila, Kochi"},
    {"id": "P14", "canonical": "Sanjay Verma", "variants": ["Sanjay Verma", "S. Verma", "SANJAY VERMA"],
     "phone_canonical": "9234509876", "phone_variants": ["+91 92345 09876", "9234509876"],
     "address": "14 Dwarka, Delhi"},
    {"id": "P15", "canonical": "Kavya Pillai", "variants": ["Kavya Pillai", "K. Pillai", "KAVYA PILLAI"],
     "phone_canonical": "9345609876", "phone_variants": ["+91 93456 09876", "9345609876"],
     "address": "19 Vastrapur, Ahmedabad"},
    {"id": "P16", "canonical": "Imran Khan", "variants": ["Imran Khan", "I. Khan", "IMRAN KHAN"],
     "phone_canonical": "9456709876", "phone_variants": ["+91 94567 09876", "9456709876"],
     "address": "25 Mehdipatnam, Hyderabad"},
    {"id": "P17", "canonical": "Divya Rajan", "variants": ["Divya Rajan", "D. Rajan", "DIVYA RAJAN"],
     "phone_canonical": "9567809876", "phone_variants": ["+91 95678 09876", "9567809876"],
     "address": "2 Satellite, Ahmedabad"},
    {"id": "P18", "canonical": "Naveen Kumar", "variants": ["Naveen Kumar", "N. Kumar", "NAVEEN KUMAR"],
     "phone_canonical": "9678909876", "phone_variants": ["+91 96789 09876", "9678909876"],
     "address": "40 Velachery, Chennai"},
    {"id": "P19", "canonical": "Shalini Nair", "variants": ["Shalini Nair", "S. Nair", "SHALINI NAIR"],
     "phone_canonical": "9789019876", "phone_variants": ["+91 97890 19876", "9789019876"],
     "address": "7 Panampilly Nagar, Kochi"},
    {"id": "P20", "canonical": "Bala Murugan", "variants": ["Bala Murugan", "B. Murugan", "BALA MURUGAN"],
     "phone_canonical": "9890129876", "phone_variants": ["+91 98901 29876", "9890129876"],
     "address": "33 Adyar, Chennai"},
]
PID = {p["id"]: p for p in PERSONS}

# ---------------------------------------------------------------------------
# Cases (12) — includes the 3 "hidden connector" cases
# ---------------------------------------------------------------------------
CASES = [
    {"case_id": "FIR-101", "date": "2026-06-02", "description": "Narcotics trafficking network operating out of Chennai suburbs", "status": "active", "officer": "Insp. R. Balan", "persons": "P01,P06", "location": "Chennai", "category": "Narcotics"},
    {"case_id": "FIR-102", "date": "2026-06-05", "description": "Cyberfraud complaint - phishing campaign targeting bank customers", "status": "active", "officer": "Insp. S. Nambiar", "persons": "P07", "location": "Delhi", "category": "Cybercrime"},
    {"case_id": "FIR-103", "date": "2026-06-08", "description": "Armed robbery at jewellery store", "status": "closed", "officer": "Insp. K. Rao", "persons": "P08,P20", "location": "Bangalore", "category": "Robbery"},
    {"case_id": "FIR-104", "date": "2026-06-10", "description": "Financial fraud - shell company siphoning investor funds", "status": "active", "officer": "Insp. M. Chandra", "persons": "P02,P12", "location": "Hyderabad", "category": "Financial Fraud"},
    {"case_id": "FIR-105", "date": "2026-06-12", "description": "Missing person report - last seen near railway station", "status": "active", "officer": "Insp. R. Balan", "persons": "P04", "location": "Chennai", "category": "Missing Person"},
    {"case_id": "FIR-106", "date": "2026-06-14", "description": "Extortion complaint from local business owner", "status": "active", "officer": "Insp. A. Farooqui", "persons": "P05,P16", "location": "Chennai", "category": "Extortion"},
    {"case_id": "FIR-107", "date": "2026-06-16", "description": "Suspected human trafficking ring", "status": "active", "officer": "Insp. M. Chandra", "persons": "P10", "location": "Hyderabad", "category": "Human Trafficking"},
    {"case_id": "FIR-108", "date": "2026-06-18", "description": "Stolen vehicle recovery investigation", "status": "closed", "officer": "Insp. J. Thomas", "persons": "P03,P18", "location": "Kochi", "category": "Vehicle Theft"},
    {"case_id": "FIR-109", "date": "2026-06-20", "description": "Cross-border vehicle smuggling operation", "status": "active", "officer": "Insp. J. Thomas", "persons": "P03,P11", "location": "Kochi", "category": "Smuggling"},
    {"case_id": "FIR-110", "date": "2026-06-22", "description": "Domestic violence complaint", "status": "closed", "officer": "Insp. S. Nambiar", "persons": "P13", "location": "Kochi", "category": "Domestic Violence"},
    {"case_id": "FIR-111", "date": "2026-06-24", "description": "Counterfeit currency circulation", "status": "active", "officer": "Insp. R. Sinha", "persons": "P14", "location": "Delhi", "category": "Counterfeiting"},
    {"case_id": "FIR-112", "date": "2026-06-26", "description": "Kidnapping for ransom", "status": "active", "officer": "Insp. P. Desai", "persons": "P15,P17", "location": "Ahmedabad", "category": "Kidnapping"},
]

BASE_DATE = datetime(2026, 6, 1)

def rand_date(days_range=60):
    return BASE_DATE + timedelta(days=random.randint(0, days_range))

def rand_time():
    return f"{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}"

# ---------------------------------------------------------------------------
# CDR records
# ---------------------------------------------------------------------------
TOWERS = ["CHN-TWR-014", "CHN-TWR-022", "HYD-TWR-007", "HYD-TWR-011", "KOC-TWR-003",
          "DEL-TWR-019", "BLR-TWR-005", "AMD-TWR-009"]

def gen_cdr(n=260):
    rows = []
    # Hidden connector: Ravi Kumar <-> Suresh Reddy, several calls across the window
    for _ in range(6):
        rows.append({
            "caller": random.choice(PID["P01"]["phone_variants"]),
            "receiver": random.choice(PID["P02"]["phone_variants"]),
            "date": rand_date().strftime("%Y-%m-%d"),
            "time": rand_time(),
            "duration_sec": random.randint(30, 900),
            "tower": random.choice(TOWERS[:2]),
            "call_type": random.choice(["voice", "sms"]),
        })
    persons_pool = PERSONS
    for _ in range(n - 6):
        caller, receiver = random.sample(persons_pool, 2)
        rows.append({
            "caller": random.choice(caller["phone_variants"]),
            "receiver": random.choice(receiver["phone_variants"]),
            "date": rand_date().strftime("%Y-%m-%d"),
            "time": rand_time(),
            "duration_sec": random.randint(10, 1200),
            "tower": random.choice(TOWERS),
            "call_type": random.choice(["voice", "sms", "voice", "voice"]),
        })
    random.shuffle(rows)
    return rows

def write_cdr():
    rows = gen_cdr()
    with open(DATA_DIR / "cdr_records.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["caller", "receiver", "date", "time", "duration_sec", "tower", "call_type"])
        w.writeheader()
        w.writerows(rows)
    return rows

# ---------------------------------------------------------------------------
# Financial records
# ---------------------------------------------------------------------------
BANKS = ["SBI", "HDFC", "ICICI", "Axis", "PNB", "Canara"]

def gen_accounts():
    accts = {}
    for p in PERSONS:
        # account number derived deterministically, with a "messy" spaced variant
        base = str(100000000000 + int(p["id"][1:]) * 987654321 % 900000000000)[:12]
        accts[p["id"]] = base
    return accts

ACCOUNTS = gen_accounts()

def spaced(acc):
    return f"{acc[0:4]} {acc[4:8]} {acc[8:12]}"

def gen_financial(n=140):
    rows = []
    # Hidden connector: Suresh Reddy -> Arun Nair, structured transfers
    for _ in range(5):
        amt = random.choice([45000, 95000, 120000, 250000, 480000])
        rows.append({
            "txn_id": f"TXN{random.randint(100000,999999)}",
            "sender_acc": random.choice([ACCOUNTS["P02"], spaced(ACCOUNTS["P02"])]),
            "receiver_acc": random.choice([ACCOUNTS["P03"], spaced(ACCOUNTS["P03"])]),
            "amount": amt,
            "timestamp": f"{rand_date().strftime('%Y-%m-%d')} {rand_time()}",
            "type": "NEFT",
            "bank": random.choice(BANKS),
        })
    for _ in range(n - 5):
        sender, receiver = random.sample(PERSONS, 2)
        rows.append({
            "txn_id": f"TXN{random.randint(100000,999999)}",
            "sender_acc": ACCOUNTS[sender["id"]],
            "receiver_acc": ACCOUNTS[receiver["id"]],
            "amount": random.choice([2000, 5500, 15000, 32000, 76000, 150000]),
            "timestamp": f"{rand_date().strftime('%Y-%m-%d')} {rand_time()}",
            "type": random.choice(["NEFT", "IMPS", "RTGS", "UPI"]),
            "bank": random.choice(BANKS),
        })
    random.shuffle(rows)
    return rows

def write_financial():
    rows = gen_financial()
    with open(DATA_DIR / "financial_records.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["txn_id", "sender_acc", "receiver_acc", "amount", "timestamp", "type", "bank"])
        w.writeheader()
        w.writerows(rows)
    return rows

# ---------------------------------------------------------------------------
# Vehicle records
# ---------------------------------------------------------------------------
STATES = ["TN", "KA", "AP", "TS", "KL", "DL", "GJ"]
MAKES = [("Maruti", "Swift", "White"), ("Hyundai", "i20", "Silver"), ("Honda", "City", "Black"),
         ("Toyota", "Innova", "White"), ("Bajaj", "Pulsar", "Red"), ("TVS", "Apache", "Blue"),
         ("Mahindra", "Scorpio", "Grey"), ("Royal Enfield", "Classic 350", "Black")]

def gen_vehicles():
    rows = []
    owners = random.sample(PERSONS, 13)
    for i, p in enumerate(owners):
        st = random.choice(STATES)
        num_raw = f"{st} {random.randint(1,99):02d} {random.choice('ABCDEFGH')}{random.choice('ABCDEFGH')} {random.randint(1000,9999)}"
        make, model, color = random.choice(MAKES)
        rows.append({
            "vehicle_number": num_raw,
            "owner": random.choice(p["variants"]),
            "date_registered": rand_date(365).strftime("%Y-%m-%d"),
            "type": "2-wheeler" if make in ("Bajaj", "TVS", "Royal Enfield") else "4-wheeler",
            "model": f"{make} {model}",
            "color": color,
            "address": p["address"],
        })
    return rows

def write_vehicles():
    rows = gen_vehicles()
    with open(DATA_DIR / "vehicle_records.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["vehicle_number", "owner", "date_registered", "type", "model", "color", "address"])
        w.writeheader()
        w.writerows(rows)
    return rows

# ---------------------------------------------------------------------------
# Location records
# ---------------------------------------------------------------------------
LOCATIONS = {
    "Chennai": (13.0827, 80.2707), "Hyderabad": (17.3850, 78.4867), "Kochi": (9.9312, 76.2673),
    "Delhi": (28.7041, 77.1025), "Bangalore": (12.9716, 77.5946), "Ahmedabad": (23.0225, 72.5714),
}

def gen_locations(n=70):
    rows = []
    for _ in range(n):
        p = random.choice(PERSONS)
        city = random.choice(list(LOCATIONS.keys()))
        lat, lon = LOCATIONS[city]
        rows.append({
            "entity_id": p["id"],
            "type": "person",
            "location": city,
            "lat": round(lat + random.uniform(-0.05, 0.05), 4),
            "long": round(lon + random.uniform(-0.05, 0.05), 4),
            "timestamp": f"{rand_date().strftime('%Y-%m-%d')} {rand_time()}",
            "source": random.choice(["CDR tower ping", "vehicle ANPR", "field report", "bank branch visit"]),
        })
    return rows

def write_locations():
    rows = gen_locations()
    with open(DATA_DIR / "location_records.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["entity_id", "type", "location", "lat", "long", "timestamp", "source"])
        w.writeheader()
        w.writerows(rows)
    return rows

# ---------------------------------------------------------------------------
# Cases CSV
# ---------------------------------------------------------------------------
def write_cases():
    with open(DATA_DIR / "cases.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["case_id", "date", "description", "status", "officer", "persons", "location", "category"])
        w.writeheader()
        w.writerows(CASES)

# ---------------------------------------------------------------------------
# Investigation report text files (freeform, for NER/relation extraction testing)
# ---------------------------------------------------------------------------
REPORT_1 = """INVESTIGATION SUMMARY REPORT
Case: FIR-101/2026
Officer: Insp. R. Balan, Chennai City Police
Date of Report: 08-06-2026

On 02-06-2026, a tip-off was received regarding narcotics trafficking activity
in the MG Road area of Chennai. Field surveillance identified Shri Ravi Kumar
(phone +91 98765 43210, residing at 15 MG Road, Chennai) as a suspected
distributor. Ravi Kumar was observed meeting Farooq Ahmed (phone +91 94567
89012) on multiple occasions near Anna Nagar between 03-06-2026 and
07-06-2026.

Call detail records obtained under warrant show that R. Kumar contacted an
unidentified Hyderabad number, 9123456780, on 04-06-2026 and again on
06-06-2026, with call durations exceeding 10 minutes. This number was
subsequently traced to Suresh Reddy of Banjara Hills, Hyderabad, who is
already under investigation in a separate financial fraud matter (Case
FIR-104). Officers recommend cross-referencing Ravi Kumar's contact network
with the Suresh Reddy financial fraud case for possible linkage.

Vehicle TN 09 AB 4521, registered to a third party, was seen parked outside
Ravi Kumar's residence on 05-06-2026 and is being traced.
"""

REPORT_2 = """INVESTIGATION SUMMARY REPORT
Case: FIR-104/2026
Officer: Insp. M. Chandra, Hyderabad Police
Date of Report: 15-06-2026

Suresh Reddy (RAVI... correction: SURESH REDDY), account holder at HDFC Bank,
Banjara Hills branch, is the primary suspect in a shell-company investment
fraud scheme. Between 10-06-2026 and 14-06-2026, Suresh Reddy transferred
funds via NEFT to an account held by Arun Nair of Fort Kochi in five separate
transactions totalling approximately Rs. 9,90,000. Rajesh Gupta, believed to
be a co-conspirator, was seen visiting Suresh Reddy's office at Banjara Hills
on 11-06-2026.

Suresh Reddy visited Marine Drive, Kochi on 13-06-2026, coinciding with a
transaction to Arun Nair's account. Investigators believe Arun Nair may be
using these funds to finance a separate vehicle smuggling operation
(cross-reference Case FIR-109). S. Reddy's phone (9123456780) shows repeated
contact with a Chennai-based number traced to Ravi Kumar, a suspect in the
ongoing narcotics case FIR-101.
"""

REPORT_3 = """INVESTIGATION SUMMARY REPORT
Case: FIR-109/2026
Officer: Insp. J. Thomas, Kochi Police
Date of Report: 27-06-2026

Arun Nair (A. Nair), residing at 8 Marine Drive, Kochi, is suspected of
running a cross-border vehicle smuggling operation. Financial records
indicate Arun Nair received Rs. 9,90,000 across five transactions from an
account belonging to Suresh Reddy of Hyderabad between 10-06-2026 and
14-06-2026. Deepa Krishnan, associated with Arun Nair through a prior vehicle
registration (KL 07 CD 8890), was seen at Fort Kochi with him on 21-06-2026
and 24-06-2026.

Arun Nair was also linked to Case FIR-108 (stolen vehicle recovery), in which
Naveen Kumar was the complainant. Given the financial link to Suresh Reddy
(Case FIR-104) and Suresh Reddy's contact with Ravi Kumar (Case FIR-101),
investigators recommend this case be treated as part of a larger interstate
network spanning narcotics, financial fraud, and smuggling.
"""

def write_reports():
    reports = {
        "report_FIR-101.txt": REPORT_1,
        "report_FIR-104.txt": REPORT_2,
        "report_FIR-109.txt": REPORT_3,
    }
    for name, content in reports.items():
        (DATA_DIR / "investigation_reports" / name).write_text(content)

# ---------------------------------------------------------------------------
# Ground truth
# ---------------------------------------------------------------------------
GROUND_TRUTH = """# EAGLE Synthetic Dataset — Ground Truth

## Hidden connector chain (the thing EAGLE should surface)

Ravi Kumar (FIR-101, Narcotics, Chennai)
  --CALLED (6x, 04/06 & 06/06 heavy)-->
Suresh Reddy (FIR-104, Financial Fraud, Hyderabad)
  --TRANSFERRED (5x NEFT, ~Rs 9,90,000, 10-14/06)-->
Arun Nair (FIR-109, Smuggling, Kochi)

Three cases opened by three different officers in three different cities,
apparently unrelated, are in fact one interstate network. This is the
"needle" the platform is designed to find.

## Entity resolution test cases (same person, different formats)

| Canonical ID | Canonical Name | Name variants injected | Phone variants injected |
|---|---|---|---|
| P01 | Ravi Kumar | Ravi Kumar / R. Kumar / RAVI KUMAR / Shri Ravi Kumar | +91 98765 43210 / 9876543210 / 091-98765-43210 |
| P02 | Suresh Reddy | Suresh Reddy / S. Reddy / SURESH REDDY / Suresh R | +91 91234 56780 / 9123456780 / 91234-56780 |
| P03 | Arun Nair | Arun Nair / A. Nair / ARUN NAIR / Mr. Arun Nair | +91 99887 76655 / 9988776655 / 099887-76655 |

(All 20 persons in `cases.csv`/`cdr_records.csv` etc. have 3-4 name-format
variants and 2-3 phone-format variants scattered across files — see
`generate_dataset.py` PERSONS list for the full canonical mapping used to
generate the data. This is the answer key for grading Laxitha's
normalizer/resolver accuracy.)

## Deliberate false-positive trap

P01 "Ravi Kumar" and P18 "Naveen Kumar" share a surname but are DIFFERENT
people (different case, different city, different phone). A good resolver
must NOT merge them just because of shared surname / partial token overlap.

## Case list (12 cases, 3 in the hidden chain)

FIR-101 Narcotics (Chennai) — Ravi Kumar, Farooq Ahmed  [chain]
FIR-102 Cybercrime (Delhi) — Priya Sharma
FIR-103 Robbery (Bangalore) — Vijay Anand, Bala Murugan
FIR-104 Financial Fraud (Hyderabad) — Suresh Reddy, Rajesh Gupta  [chain]
FIR-105 Missing Person (Chennai) — Meena Iyer
FIR-106 Extortion (Chennai) — Karthik Subramaniam, Imran Khan
FIR-107 Human Trafficking (Hyderabad) — Mohammed Yusuf
FIR-108 Vehicle Theft (Kochi) — Arun Nair, Naveen Kumar
FIR-109 Smuggling (Kochi) — Arun Nair, Deepa Krishnan  [chain]
FIR-110 Domestic Violence (Kochi) — Anitha Menon
FIR-111 Counterfeiting (Delhi) — Sanjay Verma
FIR-112 Kidnapping (Ahmedabad) — Kavya Pillai, Divya Rajan

## Files

- `cases.csv` — 12 cases
- `cdr_records.csv` — ~260 call records (includes the Ravi<->Suresh calls)
- `financial_records.csv` — ~140 transactions (includes the Suresh->Arun transfers)
- `vehicle_records.csv` — 13 vehicles
- `location_records.csv` — 70 location pings
- `investigation_reports/*.txt` — 3 freeform officer reports narrating the
  chain in prose, for NER + relation extraction testing (Leeben's pipeline)
"""

def write_ground_truth():
    (DATA_DIR / "ground_truth.md").write_text(GROUND_TRUTH)

if __name__ == "__main__":
    write_cases()
    write_cdr()
    write_financial()
    write_vehicles()
    write_locations()
    write_reports()
    write_ground_truth()
    print("Dataset generated in", DATA_DIR)
